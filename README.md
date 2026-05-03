# MockQL — GraphQL Mock Endpoint Generator

> Create a live GraphQL mock endpoint from a JSON response in seconds.
> Built by [Tanvir Shaad](https://github.com/tanvirshaad)

---
[https://tsmockql.netlify.app/](https://mockqltest.netlify.app/)
---

## What it does

MockQL lets you write a GraphQL JSON response manually, validates its structure, stores it on JSONBin.io, and gives you a live POST endpoint powered by a Cloudflare Worker — ready to plug into any app.

---

## Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend | HTML + CSS + Vanilla JS | Free |
| Hosting | Netlify | Free |
| Mock storage | JSONBin.io | Free |
| Endpoint | Cloudflare Workers | Free |

---

## Project structure

```
mockql/
├── index.html        # UI — validate & generate endpoints
├── style.css         # All styles and animations
├── app.js            # All logic — validation, API calls, clipboard
├── worker.js         # Cloudflare Worker — the mock GraphQL endpoint
└── wrangler.toml     # Cloudflare Worker config
```

---

## Setup guide

### What you'll need
- A free [JSONBin.io](https://jsonbin.io) account
- A free [Cloudflare](https://cloudflare.com) account
- A free [Netlify](https://netlify.com) account

---

### Step 1 — Deploy the Cloudflare Worker

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Register your workers.dev subdomain first (if not done yet)
# Go to dash.cloudflare.com → Workers & Pages → pick a subdomain

# Set your JSONBin master key as an encrypted secret
wrangler secret put JSONBIN_MASTER_KEY
# Paste your JSONBin Master Key when prompted — press Y if asked to create the worker

# Deploy the worker
wrangler deploy
```

After deploying, Wrangler prints your Worker URL:
```
https://mockql.YOUR-SUBDOMAIN.workers.dev
```

---

### Step 2 — Update the frontend config

Open `app.js` and update this line at the top:

```js
const WORKER_BASE_URL = 'https://mockql.YOUR-SUBDOMAIN.workers.dev';
```

Replace `YOUR-SUBDOMAIN` with your actual Cloudflare Workers subdomain.

---

### Step 3 — Deploy the website to Netlify

**Option A — Drag & drop (fastest)**
1. Go to [app.netlify.com](https://app.netlify.com) and log in
2. Drag your project folder (containing `index.html`, `style.css`, `app.js`) onto the deploy zone
3. Netlify gives you a live URL instantly

**Option B — GitHub (recommended for updates)**
1. Push your project to a GitHub repo
2. Go to Netlify → Add new site → Import from GitHub
3. Select the repo → Deploy
4. Every future `git push` auto-deploys

---

### Step 4 — Get your JSONBin API key

1. Go to [jsonbin.io](https://jsonbin.io) and create a free account
2. Go to Dashboard → API Keys
3. Copy your **Master Key** (starts with `$2a$10$...`)
4. Paste it into the **JSONBin API Key** field on the website at runtime

---

## How to use

1. Open your live Netlify site
2. Paste your JSONBin Master Key into the API Key field
3. Write or paste your mock GraphQL JSON response
4. Optionally give the endpoint a label (e.g. `get-user`)
5. Click **Generate Mock Endpoint**
6. Copy the generated URL:
   ```
   https://mockql.YOUR-SUBDOMAIN.workers.dev/graphql/64a3f2b1e3267...
   ```
7. Use it in your app as a GraphQL endpoint:
   ```js
   const client = new ApolloClient({
     uri: 'https://mockql.YOUR-SUBDOMAIN.workers.dev/graphql/64a3f2b1e3267...',
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
| Server misconfigured | `{ errors: [{ message: "Worker misconfigured" }] }` |

CORS is open for all origins — call the endpoint from any browser or server app.

---

## Security notes

- Your JSONBin Master Key is entered at runtime in the browser — it is never stored in code or committed to Git
- The Cloudflare Worker secret (`JSONBIN_MASTER_KEY`) is stored encrypted on Cloudflare's servers via `wrangler secret put` — it never appears in any file
- `wrangler.toml` contains no secrets and is safe to commit
- The `.wrangler/` folder is just local build cache — safe to commit or ignore

---

## Updating a mock response

Each generated endpoint is tied to a JSONBin bin ID. To update:
- Go to [jsonbin.io](https://jsonbin.io), find your bin, and edit the JSON directly — the endpoint URL stays the same
- Or generate a new endpoint from the website (creates a new bin with a new URL)

---

## Author

**Tanvir Shaad**
GitHub: [github.com/tanvirshaad](https://github.com/tanvirshaad)
