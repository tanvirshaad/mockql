# MockQL — GraphQL Mock Endpoint Generator (v2.1)

> Create a live GraphQL mock endpoint from a JSON response in seconds.
> Choose your storage: Cloudflare KV or Supabase Postgres.
> Built by [Tanvir Shaad](https://github.com/tanvirshaad)

---
[https://mockqltest.netlify.app/]
---


## What's New (v2.1)

✅ Dual storage backends: Cloudflare KV + Supabase Postgres
✅ User chooses backend per mock
✅ Auto-detection when editing
✅ No JSONBin dependency — never down again

---

## Storage Options

| Backend | Limit | Cost | Best For |
|---|---|---|---|
| **Cloudflare KV** | 1,000 writes/day | Free | Small projects, testing |
| **Supabase Postgres** | Unlimited writes | Free | Production, heavy use |

---

## Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend | HTML + CSS + Vanilla JS | Free |
| Hosting | Netlify | Free |
| Endpoint | Cloudflare Workers | Free |
| Storage | KV or Postgres | Free |

---

## Project Structure

```
mockql/
├── index.html        # UI with backend choice
├── style.css         # Styles
├── app.js            # Logic (both backends)
├── worker.js         # Cloudflare Worker (dual backend)
└── wrangler.toml     # Cloudflare config
```

---

## Setup Guide

### Prerequisites

- Cloudflare account (free)
- Netlify account (free)
- Optionally: Supabase account (free, only if using Postgres backend)

---

### Step 1 — Deploy Cloudflare Worker (with KV)

```bash
npm install -g wrangler
wrangler login

# Create KV namespace
wrangler kv namespace create MOCK_STORE

# Copy the returned ID into wrangler.toml under [kv_namespaces]
# Edit wrangler.toml and paste: id = "YOUR_KV_NAMESPACE_ID"

# Deploy
wrangler deploy
```

**Output:** Your Worker URL
```
https://mockql.YOUR-SUBDOMAIN.workers.dev
```

---

### Step 2 — (Optional) Set up Supabase for Postgres Backend

If you want to use the **Supabase Postgres** storage option (unlimited writes):

#### 2a. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up / log in
3. Create a new project (free tier)
4. Copy your **Project URL** (Settings → API)
5. Copy your **anon public key** (Settings → API)

#### 2b. Create the `mocks` table

Go to **SQL Editor** in Supabase and run:

```sql
CREATE TABLE mocks (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  label TEXT DEFAULT 'mock-endpoint',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security (RLS) - set to public for now
ALTER TABLE mocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mocks are publicly readable" ON mocks
  FOR SELECT USING (true);

CREATE POLICY "Mocks are publicly insertable" ON mocks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Mocks are publicly updatable" ON mocks
  FOR UPDATE USING (true);
```

#### 2c. Add Supabase config to Worker

```bash
wrangler secret put SUPABASE_URL
# Paste your Supabase Project URL

wrangler secret put SUPABASE_ANON_KEY
# Paste your anon public key

wrangler deploy
```

---

### Step 3 — Update Frontend Config

Open `app.js` and update:

```js
const WORKER_BASE_URL = 'https://mockql.YOUR-SUBDOMAIN.workers.dev';
```

Replace `YOUR-SUBDOMAIN` with your actual Cloudflare Workers subdomain.

---

### Step 4 — Deploy Website to Netlify

**Option A — Drag & Drop**
1. Go to [app.netlify.com](https://app.netlify.com)
2. Drag `index.html`, `style.css`, `app.js` into the deploy zone
3. Done — you get a live URL

**Option B — GitHub**
1. Push to GitHub repo
2. Connect Netlify to the repo
3. Auto-deploys on every push

---

## How to Use

### Creating an Endpoint

1. Open your Netlify site
2. Enter your mock JSON response in the editor
3. Choose storage backend:
   - **Cloudflare KV** — free, 1K writes/day limit
   - **Supabase Postgres** — free, unlimited writes (requires setup)
4. Add optional endpoint label
5. Click **Generate Mock Endpoint**
6. Copy the generated URL

### Editing an Endpoint

1. Switch to **Edit existing** tab
2. Paste your endpoint URL or Mock ID
3. Click **Load**
4. Make changes to the JSON
5. Click **Update Mock Endpoint**
6. URL stays the same — clients auto-get new response

### Using the Endpoint in Your App

```js
const response = await fetch('https://mockql.xxx.workers.dev/graphql/kv_abc123', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `{ user { id name } }`,
  }),
});

const data = await response.json();
console.log(data); // → your mock response
```

---

## ID Format

MockQL automatically prefixes IDs with the backend type:

- `kv_abc123xyz` = stored in Cloudflare KV
- `pg_xyz789abc` = stored in Supabase Postgres

When editing, the UI auto-detects the backend from the ID — no extra configuration needed.

---

## Endpoint Behavior

| Request | Response |
|---|---|
| `POST /graphql/:id` (any query) | Always returns your mock JSON |
| `GET /graphql/:id` | Same as POST |
| Wrong ID | `{ errors: [{ message: "Mock not found" }] }` |

CORS is open for all origins.

---

## Troubleshooting

### "Postgres backend not configured"

You haven't set up Supabase secrets. Run:
```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler deploy
```

### "KV namespace not found"

Make sure `wrangler.toml` has the correct `id` under `[[kv_namespaces]]`.

### Changes not showing up

- For KV: changes are instant
- For Postgres: wait a few seconds for the REST API to sync

---

## API Reference

### POST /mock

Create a new mock

```bash
curl -X POST "https://mockql.xxx.workers.dev/mock?backend=kv&label=my-endpoint" \
  -H "Content-Type: application/json" \
  -d '{"data":{"user":{"id":"1"}}}'

# Response:
# {
#   "id": "kv_abc123",
#   "backend": "kv",
#   "label": "my-endpoint",
#   "createdAt": "2024-..."
# }
```

### GET /mock/:id

Fetch an existing mock (for editing)

```bash
curl "https://mockql.xxx.workers.dev/mock/kv_abc123"

# Response:
# {
#   "id": "kv_abc123",
#   "data": {"user":{"id":"1"}},
#   "metadata": {...}
# }
```

### PUT /mock/:id

Update an existing mock

```bash
curl -X PUT "https://mockql.xxx.workers.dev/mock/kv_abc123" \
  -H "Content-Type: application/json" \
  -d '{"data":{"user":{"id":"2"}}}'
```

### GET|POST /graphql/:id

Serve mock as GraphQL endpoint (what your app calls)

```bash
curl -X POST "https://mockql.xxx.workers.dev/graphql/kv_abc123" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ user { id } }"}'

# Response: your mock JSON
# {"data":{"user":{"id":"1"}}}
```

---

## Architecture

```
┌─────────────────┐
│   Your App      │
│  (Apollo, urql) │
└────────┬────────┘
         │
         │ POST /graphql/:id
         ↓
┌──────────────────────────┐
│  Cloudflare Worker       │
│  (mockql.xxx.dev)        │
│  ┌────────────────────┐  │
│  │ GraphQL Router     │  │
│  │ Detects: kv_ / pg_ │  │
│  └─────┬────────┬─────┘  │
│        ↓        ↓        │
│   ┌───────┐  ┌─────────┐ │
│   │  KV   │  │ Postgres│ │
│   └───────┘  └─────────┘ │
└──────────────────────────┘
```

---

## Security

- No sensitive keys in frontend code
- Supabase secrets stored encrypted in Cloudflare
- RLS policies on Postgres allow public read/write (mocks are meant to be public)
- CORS open to all origins (by design — mocks are test data)

---

## Author

**Tanvir Shaad**
GitHub: [github.com/tanvirshaad](https://github.com/tanvirshaad)

---

## License

MIT