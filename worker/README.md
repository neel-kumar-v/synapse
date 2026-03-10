This directory contains the original Cloudflare Worker that powers the Sandbox
API used by the `dashboard` Next.js app.

Key entrypoints:

- `src/index.ts` — Worker source
- `wrangler.jsonc` — Wrangler configuration
- `Dockerfile` — Sandbox container image

Secrets (local: copy `.dev.vars.example` to `.dev.vars`; production: `wrangler secret put <NAME>`):

- **GEMINI_API_KEY** (optional) — Used to refine voice/chat input into short actionable prompts before calling the code model. Get a key at https://aistudio.google.com/apikey
- **SUPERMEMORY_API_KEY** (optional) — Long-term memory per sandbox.

After editing files in `starter/` (e.g. `studio.html`), regenerate the bundle:

    node scripts/generate-starter-files.mjs

