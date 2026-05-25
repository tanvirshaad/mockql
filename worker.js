/**
 * MockQL — Cloudflare Worker
 *
 * Stores mock JSON in KV and serves it back from:
 *   POST /mock/:id
 *   GET  /mock/:id
 *   PUT  /mock/:id
 *
 * Creates a new mock with:
 *   POST /mock
 *
 * Deploy:
 *   1. npm install -g wrangler
 *   2. wrangler login
 *   3. wrangler deploy
 */

// ── CORS headers ──────────────────────────────────────────────
const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
};

// ── Main handler ──────────────────────────────────────────────
export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS });
        }

        // Health check
        if (url.pathname === '/' || url.pathname === '/health') {
            return json({ status: 'ok', service: 'MockQL Worker' });
        }

        if (url.pathname === '/mock' && request.method === 'POST') {
            return createMock(request, env, url.origin);
        }

        const match = url.pathname.match(/^\/mock\/([a-zA-Z0-9]+)$/);
        if (!match) {
            return json(
                { errors: [{ message: 'Not found. Use /mock or /mock/:id' }] },
                404,
            );
        }

        const mockId = match[1];

        if (request.method === 'PUT') {
            return updateMock(request, env, mockId, url.origin);
        }

        if (request.method === 'GET' || request.method === 'POST') {
            return serveMock(env, mockId);
        }

        return json(
            { errors: [{ message: `Method ${request.method} not allowed` }] },
            405,
        );
    },
};

async function createMock(request, env, origin) {
    const store = getStore(env);
    if (!store) {
        return json(
            {
                errors: [
                    {
                        message:
                            'Worker misconfigured: MOCKQL_TESTER binding not set',
                    },
                ],
            },
            500,
        );
    }

    const payload = await readJsonBody(request);
    if ('errors' in payload) {
        return json(payload, 400);
    }

    const mockId = makeMockId();
    await store.put(mockId, JSON.stringify(payload));

    return json(
        {
            id: mockId,
            url: `${origin}/mock/${mockId}`,
        },
        201,
    );
}

async function updateMock(request, env, mockId, origin) {
    const store = getStore(env);
    if (!store) {
        return json(
            {
                errors: [
                    {
                        message:
                            'Worker misconfigured: MOCKQL_TESTER binding not set',
                    },
                ],
            },
            500,
        );
    }

    const existing = await store.get(mockId);
    if (existing === null) {
        return json(
            { errors: [{ message: `Mock not found: ${mockId}` }] },
            404,
        );
    }

    const payload = await readJsonBody(request);
    if ('errors' in payload) {
        return json(payload, 400);
    }

    await store.put(mockId, JSON.stringify(payload));

    return json({ id: mockId, url: `${origin}/mock/${mockId}` });
}

async function serveMock(env, mockId) {
    const store = getStore(env);
    if (!store) {
        return json(
            {
                errors: [
                    {
                        message:
                            'Worker misconfigured: MOCKQL_TESTER binding not set',
                    },
                ],
            },
            500,
        );
    }

    const stored = await store.get(mockId);
    if (stored === null) {
        return json(
            { errors: [{ message: `Mock not found: ${mockId}` }] },
            404,
        );
    }

    try {
        return json(JSON.parse(stored));
    } catch {
        return json(
            { errors: [{ message: `Stored mock ${mockId} is invalid JSON` }] },
            500,
        );
    }
}

function getStore(env) {
    return env.MOCKQL_TESTER || null;
}

async function readJsonBody(request) {
    try {
        return await request.json();
    } catch {
        return { errors: [{ message: 'Request body must be valid JSON' }] };
    }
}

function makeMockId() {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

// ── JSON response helper ──────────────────────────────────────
function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...CORS,
        },
    });
}
