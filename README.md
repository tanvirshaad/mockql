# MockQL — Setup Guide

## What you'll need
- A free [JSONBin.io](https://jsonbin.io) account (for storing mock responses)
- A free [Cloudflare](https://cloudflare.com) account (for the Worker endpoint)
- A free [Netlify](https://netlify.com) or [GitHub Pages](https://pages.github.com) account (for hosting the website)

---

## Step 1 — Deploy the Cloudflare Worker

The Worker is the engine that turns your stored JSON into a live GraphQL endpoint.

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Set your JSONBin master key as a secret
wrangler secret put JSONBIN_MASTER_KEY
# Paste your JSONBin master key when prompted

# Deploy the worker
wrangler deploy
```

After deploying, Wrangler will print your Worker URL:
```
https://mockql.YOUR-SUBDOMAIN.workers.dev
```

---

## Step 2 — Update the website config

Open `index.html` and find this line near the top of the `<script>` tag:

```js
const WORKER_BASE_URL = 'https://mockql.YOUR-SUBDOMAIN.workers.dev';
```

Replace `YOUR-SUBDOMAIN` with your actual Cloudflare Workers subdomain.

---

## Step 3 — Deploy the website

### Option A: Netlify (drag & drop)
1. Go to [app.netlify.com](https://app.netlify.com)
2. Drag your `index.html` file onto the deploy zone
3. Done — you get a live URL instantly

### Option B: GitHub Pages
1. Create a new GitHub repo
2. Upload `index.html` as the only file
3. Go to Settings → Pages → Deploy from branch → main
4. Your site is live at `https://YOUR-USERNAME.github.io/REPO-NAME`

---

## Step 4 — Get your JSONBin API key

1. Go to [jsonbin.io](https://jsonbin.io) and create a free account
2. Go to your Dashboard → API Keys
3. Copy your **Master Key** (starts with `$2a$10$...`)
4. Paste it into the "JSONBin API Key" field on the website

---

## How to use

1. Open your hosted website
2. Paste your JSONBin API key
3. Type or paste your mock GraphQL JSON response
4. Optionally give the endpoint a label
5. Click **Generate Mock Endpoint**
6. Copy the generated URL — e.g.:
   ```
   https://mockql.your-subdomain.workers.dev/graphql/64a3f2b1e3267...
   ```
7. Use it in your app as a GraphQL endpoint:
   ```js
   const client = new ApolloClient({
     uri: 'https://mockql.your-subdomain.workers.dev/graphql/64a3f2b1e3267...',
     cache: new InMemoryCache(),
   });
   ```

---

## Endpoint behavior

| What the client sends | What the endpoint returns |
|---|---|
| Any GraphQL POST (any query, any variables) | Always your mock JSON |
| GET request | Also returns your mock JSON |
| Wrong bin ID | `{ errors: [{ message: "Mock not found" }] }` |

CORS is enabled for all origins, so you can call the endpoint from any browser app.

---

## Updating a mock response

Endpoints are tied to a JSONBin bin ID. To update the response:
- Go to [jsonbin.io](https://jsonbin.io), find your bin, and edit the JSON directly
- Or generate a new endpoint from the website (creates a new bin)

---

## Files

| File | Purpose |
|---|---|
| `index.html` | The website — validate & generate endpoints |
| `worker.js` | Cloudflare Worker — the mock GraphQL endpoint |
| `wrangler.toml` | Cloudflare Worker config |
