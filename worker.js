/**
 * MockQL — Cloudflare Worker
 *
 * Accepts any GraphQL POST request at:
 *   POST /graphql/:binId
 *
 * Fetches the stored mock JSON from JSONBin.io
 * and returns it as the GraphQL response.
 *
 * Deploy:
 *   1. npm install -g wrangler
 *   2. wrangler login
 *   3. wrangler deploy
 */

// ── Config ────────────────────────────────────────────────────
// Set this in your Cloudflare Worker environment variables
// wrangler secret put JSONBIN_MASTER_KEY
// Or hardcode for testing (not recommended for production):
// const JSONBIN_MASTER_KEY = '$2a$10$...';

const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b';

// ── CORS headers ──────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
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

    // Route: POST /graphql/:binId
    const match = url.pathname.match(/^\/graphql\/([a-zA-Z0-9]+)$/);
    if (!match) {
      return json({ errors: [{ message: 'Not found. Use POST /graphql/:binId' }] }, 404);
    }

    const binId = match[1];

    // Only allow POST and GET for GraphQL
    if (!['POST', 'GET'].includes(request.method)) {
      return json({ errors: [{ message: `Method ${request.method} not allowed` }] }, 405);
    }

    // Fetch mock from JSONBin
    const masterKey = env.JSONBIN_MASTER_KEY;
    if (!masterKey) {
      return json({ errors: [{ message: 'Worker misconfigured: JSONBIN_MASTER_KEY not set' }] }, 500);
    }

    let mockResponse;
    try {
      mockResponse = await fetchFromJSONBin(binId, masterKey);
    } catch (err) {
      if (err.status === 404) {
        return json({ errors: [{ message: `Mock not found for bin: ${binId}` }] }, 404);
      }
      return json({ errors: [{ message: `Failed to fetch mock: ${err.message}` }] }, 502);
    }

    // Return the mock response
    return json(mockResponse);
  }
};

// ── Fetch from JSONBin ────────────────────────────────────────
async function fetchFromJSONBin(binId, masterKey) {
  const res = await fetch(`${JSONBIN_BASE}/${binId}/latest`, {
    headers: {
      'X-Master-Key': masterKey,
    },
    // Cache for 30 seconds to avoid hammering JSONBin on every request
    cf: { cacheTtl: 30, cacheEverything: true },
  });

  if (!res.ok) {
    const err = new Error(`JSONBin responded with ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  // JSONBin wraps response in { record: { ...yourData } }
  return data.record;
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
