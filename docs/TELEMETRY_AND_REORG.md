# Telemetry + codebase layout for Aura11y

## Where telemetry runs

**UX telemetry runs in the beta-tester's browser** (e.g. Cloudflare sandbox page), not in the dashboard or the Worker. The dashboard only uses it for the **test page** (`/ux_telemetry`). The canonical module is **`dashboard/src/ux_telemetry/`** — modular, client-only, no dashboard-specific code.

---

## How to run the Hume / UX telemetry test

The test page is served by the **dashboard** (Next.js). From repo root, `npm run dev` runs the **Worker**; use the dashboard for the test:

```bash
npm run dev:telemetry
```

or `npm run dev:dashboard`, then open **http://localhost:3000/ux_telemetry**. Set `NEXT_PUBLIC_HUME_API_KEY` in `dashboard/.env.local`.

---

## Repo layout

| Part | Who uses it | Where |
|------|-------------|--------|
| **Dashboard** | Admin (developer / site owner) | `dashboard/` — Next.js. Overview, Runs, Files, Telemetry test page. |
| **Worker** | Sandbox runtime for beta users | `worker/` — Cloudflare Worker + Sandbox. Serves sandbox APIs. |
| **UX Telemetry** | Beta-tester session (and dashboard test page) | `dashboard/src/ux_telemetry/` — emotion_tracking, mouse_tracking. Client-only. |

---

## Using telemetry in the beta-tester sandbox

1. **Beta route in the same app** — Add a route (e.g. `/s/[sandboxId]`) that renders the sandbox and uses the `ux_telemetry` hooks (`useHumeStream`, `useMouseTracker`, `initPostHog`) to emit raw events with timestamps. Forward those events to your backend / Convex.
2. **Worker-served page** — Build a client bundle from `dashboard/src/ux_telemetry` (and React) and load it in the HTML the Worker serves.
3. **Separate tester app** — Copy or link `dashboard/src/ux_telemetry` into that app.

Single source of truth: `dashboard/src/ux_telemetry`.
