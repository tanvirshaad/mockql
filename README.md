# MockQL — GraphQL Mock Endpoint Generator

> Create a live GraphQL mock endpoint from a JSON response in seconds.
> Built by [Tanvir Shaad](https://github.com/tanvirshaad)

---
[https://mockqltest.netlify.app/]
---

## What it does

MockQL lets you write a GraphQL JSON response manually, validates its structure, stores it in Cloudflare KV, and gives you a live mock endpoint powered by a Cloudflare Worker — ready to plug into any app.

---

## Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend | HTML + CSS + Vanilla JS | Free |
| Hosting | Netlify | Free |
| Mock storage | Cloudflare KV | Free |
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

# Create a KV namespace for mock storage
wrangler kv namespace create MOCKQL_TESTER
# Paste the namespace ID into wrangler.toml

# Deploy the worker
wrangler deploy
```

After deploying, Wrangler prints your Worker URL:
```
https://mockql.YOUR-SUBDOMAIN.workers.dev
```

---

### Step 2 — Update the frontend config

Open the website and paste your deployed Worker URL into the **Worker URL** field.

Use the `/mock` base URL, for example:

```text
https://mockql.YOUR-SUBDOMAIN.workers.dev/mock
```

The app remembers the value in your browser for next time.

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

### Step 4 — Set the worker URL

1. Paste your deployed Worker URL into the **Worker URL** field
2. The site no longer needs any API key or secret

---

## How to use

1. Open your live Netlify site
2. The website talks to your Worker directly, so no API key is needed
3. Write or paste your mock GraphQL JSON response
4. Optionally give the endpoint a label (e.g. `get-user`)
5. Click **Generate Mock Endpoint**
6. Copy the generated URL:
   ```
   https://mockql.YOUR-SUBDOMAIN.workers.dev/mock/64a3f2b1e3267...
   ```
7. Use it in your app as a GraphQL endpoint:
   ```js
   const client = new ApolloClient({
     uri: 'https://mockql.YOUR-SUBDOMAIN.workers.dev/mock/64a3f2b1e3267...',
     cache: new InMemoryCache(),
   });
   ```

---

## Endpoint behavior

| What the client sends | What the endpoint returns |
|---|---|
| Any GraphQL POST (any query, any variables) | Always your mock JSON |
| GET request | Also returns your mock JSON |
| Wrong mock ID | `{ errors: [{ message: "Mock not found" }] }` |
| Server misconfigured | `{ errors: [{ message: "Worker misconfigured" }] }` |

CORS is open for all origins — call the endpoint from any browser or server app.

---

## Security notes

- No API key is entered in the browser — the site talks only to your Worker
- The Cloudflare KV namespace binding (`MOCKQL_TESTER`) is stored in `wrangler.toml` and uses the namespace ID you created with Wrangler
- `wrangler.toml` contains no secrets and is safe to commit
- The `.wrangler/` folder is just local build cache — safe to commit or ignore

---

## Updating a mock response

Each generated endpoint is tied to a mock ID. To update:
- Open the endpoint in the app and use the edit flow, or `PUT` the same `/mock/:id` URL
- Or generate a new endpoint from the website (creates a new mock with a new URL)

---

## Author

**Tanvir Shaad**
GitHub: [github.com/tanvirshaad](https://github.com/tanvirshaad)
