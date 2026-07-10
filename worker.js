/**
 * MockQL — Cloudflare Worker (Dual Backend Edition)
 *
 * Supports both:
 *   - Cloudflare KV (free tier, 1,000 writes/day)
 *   - Supabase Postgres (free tier, unlimited writes)
 *
 * Routes:
 *   POST   /mock              → save new mock (backend via ?backend=kv|postgres)
 *   GET    /mock/:id          → fetch mock (auto-detects backend from id prefix)
 *   PUT    /mock/:id          → update mock (auto-detects backend from id prefix)
 *   POST   /graphql/:id       → serve mock as GraphQL endpoint
 *   GET    /graphql/:id       → same, for GET clients
 *
 * ID format:
 *   kv_xxxxx      = stored in Cloudflare KV
 *   pg_xxxxx      = stored in Supabase Postgres
 */

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS });
        }

        if (url.pathname === '/' || url.pathname === '/health') {
            return json({ status: 'ok', service: 'MockQL', version: '2.0' });
        }

        // ── POST /mock ──────────────────────────────────────────────
        if (url.pathname === '/mock' && request.method === 'POST') {
            const backend = url.searchParams.get('backend') || 'kv';
            let body;
            try {
                body = await request.json();
            } catch {
                return json({ error: 'Invalid JSON' }, 400);
            }

            const label = url.searchParams.get('label') || 'mock-endpoint';

            if (backend === 'postgres') {
                return await saveToDB(body, label, env);
            } else {
                return await saveToKV(body, label, env);
            }
        }

        // ── GET /mock/:id ───────────────────────────────────────────
        const getMatch = url.pathname.match(
            /^\/mock\/([a-z]+_[a-zA-Z0-9_-]+)$/,
        );
        if (getMatch && request.method === 'GET') {
            const id = getMatch[1];
            if (id.startsWith('pg_')) {
                return await loadFromDB(id, env);
            } else {
                return await loadFromKV(id, env);
            }
        }

        // ── PUT /mock/:id ───────────────────────────────────────────
        const putMatch = url.pathname.match(
            /^\/mock\/([a-z]+_[a-zA-Z0-9_-]+)$/,
        );
        if (putMatch && request.method === 'PUT') {
            const id = putMatch[1];
            let body;
            try {
                body = await request.json();
            } catch {
                return json({ error: 'Invalid JSON' }, 400);
            }

            if (id.startsWith('pg_')) {
                return await updateDB(id, body, env);
            } else {
                return await updateKV(id, body, env);
            }
        }

        // ── GET|POST /graphql/:id ───────────────────────────────────
        const gqlMatch = url.pathname.match(
            /^\/graphql\/([a-z]+_[a-zA-Z0-9_-]+)$/,
        );
        if (gqlMatch && ['GET', 'POST'].includes(request.method)) {
            const id = gqlMatch[1];
            let data;

            if (id.startsWith('pg_')) {
                const res = await loadFromDB(id, env);
                if (res.status !== 200) return res;
                const payload = await res.json();
                data = payload.data;
            } else {
                const res = await loadFromKV(id, env);
                if (res.status !== 200) return res;
                const payload = await res.json();
                data = payload.data;
            }

            return json(data);
        }

        return json({ error: 'Not found' }, 404);
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// KV BACKEND
// ─────────────────────────────────────────────────────────────────────────────

async function saveToKV(data, label, env) {
    const id = 'kv_' + generateId();
    const metadata = { label, createdAt: new Date().toISOString() };
    await env.MOCK_STORE_KV.put(id, JSON.stringify(data), { metadata });
    return json(
        { id, label, backend: 'kv', createdAt: metadata.createdAt },
        201,
    );
}

async function loadFromKV(id, env) {
    const stored = await env.MOCK_STORE_KV.getWithMetadata(id, {
        type: 'json',
    });
    if (!stored.value) {
        return json({ error: `Mock not found: ${id}` }, 404);
    }
    return json({ id, data: stored.value, metadata: stored.metadata });
}

async function updateKV(id, data, env) {
    const existing = await env.MOCK_STORE_KV.getWithMetadata(id);
    if (!existing.value) {
        return json({ error: `Mock not found: ${id}` }, 404);
    }
    const metadata = {
        ...(existing.metadata || {}),
        updatedAt: new Date().toISOString(),
    };
    await env.MOCK_STORE_KV.put(id, JSON.stringify(data), { metadata });
    return json({ id, backend: 'kv', updatedAt: metadata.updatedAt });
}

// ─────────────────────────────────────────────────────────────────────────────
// POSTGRES BACKEND (Supabase)
// ─────────────────────────────────────────────────────────────────────────────

async function saveToDB(data, label, env) {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return json({ error: 'Postgres backend not configured' }, 500);
    }

    const id = 'pg_' + generateId();

    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/mocks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ id, data, label }),
        });

        if (!res.ok) {
            const err = await res.text();
            return json({ error: `Postgres error: ${err}` }, 502);
        }

        return json(
            {
                id,
                label,
                backend: 'postgres',
                createdAt: new Date().toISOString(),
            },
            201,
        );
    } catch (err) {
        return json({ error: `Postgres error: ${err.message}` }, 502);
    }
}

async function loadFromDB(id, env) {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return json({ error: 'Postgres backend not configured' }, 500);
    }

    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/mocks?id=eq.${id}`, {
            headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
            },
        });

        if (!res.ok) {
            return json({ error: 'Postgres error' }, 502);
        }

        const rows = await res.json();
        if (!rows || rows.length === 0) {
            return json({ error: `Mock not found: ${id}` }, 404);
        }

        const row = rows[0];
        return json({
            id,
            data: row.data,
            metadata: {
                label: row.label,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            },
        });
    } catch (err) {
        return json({ error: `Postgres error: ${err.message}` }, 502);
    }
}

async function updateDB(id, data, env) {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return json({ error: 'Postgres backend not configured' }, 500);
    }

    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/mocks?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
                data,
                updated_at: new Date().toISOString(),
            }),
        });

        if (!res.ok) {
            return json({ error: 'Postgres error' }, 502);
        }

        return json({
            id,
            backend: 'postgres',
            updatedAt: new Date().toISOString(),
        });
    } catch (err) {
        return json({ error: `Postgres error: ${err.message}` }, 502);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function generateId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(12)))
        .map((b) => b.toString(36).padStart(2, '0'))
        .join('')
        .slice(0, 12);
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS },
    });
}
