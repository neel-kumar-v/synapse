# Synapse
---

## What's in this repo

```
synapse/
├── worker/        Cloudflare Worker — sandbox API, AI code gen, file serving
├── dashboard/     Next.js app — admin UI, tester dashboard, Convex backend
├── convex/        (inside dashboard/) Convex schema, mutations, actions
└── Dockerfile     Container image used by each sandbox
```

---

## Prerequisites

| Tool | Purpose |
|---|---|
| Node.js 18+ | Running everything locally |
| [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) | Cloudflare Worker dev & deploy |
| Cloudflare account | Worker + Containers + AI binding |
| [Convex account](https://convex.dev) | Database & backend actions |

---

## Third-party services you need accounts for

| Service | Used for | Where to get key |
|---|---|---|
| **Cloudflare AI** | Code generation (Llama 3.3) | Enabled automatically via Worker AI binding |
| **Convex** | Database, GitHub actions, tester management | [convex.dev](https://convex.dev) |
| **Supermemory** | Per-sandbox long-term memory & PR changelog | [supermemory.ai](https://supermemory.ai) |
| **Resend** | Tester invite emails | [resend.com](https://resend.com) |
| **ElevenLabs** | Text-to-speech (voice responses) | [elevenlabs.io](https://elevenlabs.io) |
| **Hume AI** | Emotion detection telemetry | [hume.ai](https://hume.ai) |
| **Gemini** | Prompt refinement (speech-to-text cleanup) | [aistudio.google.com](https://aistudio.google.com) |
| **GitHub token** | PR creation & repo import | GitHub → Settings → Developer settings → PAT |

---

## Setup

### 1. Install dependencies

```bash
# Root
npm install

# Worker
cd worker && npm install

# Dashboard
cd dashboard && npm install
```

### 2. Configure the Worker

The worker reads secrets at runtime. For local development create `worker/.dev.vars`:

```ini
GEMINI_API_KEY=your_gemini_key
SUPERMEMORY_API_KEY=your_supermemory_key
```

For production, set them as Wrangler secrets:

```bash
cd worker
wrangler secret put GEMINI_API_KEY
wrangler secret put SUPERMEMORY_API_KEY
```

### 3. Configure the Dashboard

Create `dashboard/.env.local`:

```ini
# Convex (run `npx convex dev` once to generate these)
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://<your-deployment>.convex.site
CONVEX_DEPLOYMENT=dev:<your-deployment>

# Worker URL (use the deployed URL, or http://localhost:8787 for local)
NEXT_PUBLIC_WORKER_BASE_URL=https://<your-worker>.workers.dev

# Auth
BETTER_AUTH_SECRET=<random-32-char-string>

# Services
RESEND_API_KEY=re_...
ELEVENLABS_API_KEY=sk_...
NEXT_PUBLIC_HUME_API_KEY=...
GEMINI_API_KEY=...
SUPERMEMORY_API_KEY=sm_...
```

### 4. Configure Convex environment variables

In the [Convex dashboard](https://dashboard.convex.dev), set these under your deployment's **Environment Variables**:

```
WORKER_BASE_URL          https://<your-worker>.workers.dev
GITHUB_TOKEN             ghp_... (needs repo + pull_request scopes)
RESEND_API_KEY           re_...
SUPERMEMORY_API_KEY      sm_...
SITE_URL                 https://your-dashboard-domain.com
```

---

## Running locally

Open three terminals:

```bash
# Terminal 1 — Worker (runs at http://localhost:8787)
cd worker && npm run dev

# Terminal 2 — Convex (watches & syncs schema/functions)
cd dashboard && npx convex dev

# Terminal 3 — Dashboard (runs at http://localhost:3000)
cd dashboard && npm run dev
```

> **Note:** Cloudflare Containers are disabled in local dev (`enable_containers: false` in `wrangler.jsonc`). The sandbox preview and file APIs still work via the Worker's direct file-serving routes.

---

## Deploying

### Deploy the Worker

```bash
cd worker
npm run deploy
```

This generates the starter files, then deploys to Cloudflare Workers. The worker URL (`https://<name>.<account>.workers.dev`) is what you put in `NEXT_PUBLIC_WORKER_BASE_URL` and Convex's `WORKER_BASE_URL`.

### Deploy Convex

```bash
cd dashboard
npx convex deploy
```

### Deploy the Dashboard

The dashboard is a standard Next.js app — deploy to Vercel, or self-host with `npm run build && npm start`. Set all `dashboard/.env.local` values as environment variables in your hosting platform.

---

## Core flows

**Admin creates a project** → links a GitHub repo → invites testers via email.

**Tester opens their sandbox** → the Worker initialises a live container with the starter app (or the imported GitHub repo) → the tester describes changes via text or voice → the AI edits the files in real time.

**Admin creates a PR** → per-sandbox: exports the sandbox files → creates a branch → opens a GitHub PR with a Supermemory-generated changelog. Or use **Merge PRs** to aggregate multiple sandboxes into one PR.

---

## Architecture

```
Browser (Next.js Dashboard)
    │
    ├── Convex (DB + Actions)
    │       ├── GitHub API  (repo import, branch, commit, PR)
    │       └── Supermemory (change history → PR description)
    │
    └── Cloudflare Worker (edge)
            ├── Cloudflare Containers  (per-sandbox isolated filesystem)
            ├── Cloudflare AI          (Llama 3.3 code generation)
            └── Supermemory            (prompt memory + context retrieval)
```
