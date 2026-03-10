import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./betterAuth/auth";
import { httpAction } from "./_generated/server";

const SERVICE_SECRET_ENV = "MODAL_SERVICE_SECRET";

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function checkSecret(body: { serviceSecret?: string } | null, headers: Headers): { ok: true } | { ok: false; status: number; body: unknown } {
  const expected = process.env[SERVICE_SECRET_ENV];
  const secret = body?.serviceSecret ?? headers.get("x-service-secret") ?? "";
  if (!expected || expected !== secret) {
    return { ok: false, status: 401, body: { error: "Invalid service secret" } };
  }
  return { ok: true };
}

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

// Modal service-auth: callable without user JWT; validate shared secret (MODAL_SERVICE_SECRET) in Convex env.
http.route({
  path: "/modal/ping",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const body = (await request.json().catch(() => ({}))) as { serviceSecret?: string };
    const valid = checkSecret(body, request.headers);
    if (!valid.ok) return jsonResponse(valid.body, valid.status);
    return jsonResponse({ ok: true, service: "convex", at: new Date().toISOString() }, 200);
  }),
});

http.route({
  path: "/modal/tasks",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const body = (await request.json().catch(() => ({}))) as { serviceSecret?: string };
    const valid = checkSecret(body, request.headers);
    if (!valid.ok) return jsonResponse(valid.body, valid.status);
    return jsonResponse([] as { id: string; payload: unknown }[], 200);
  }),
});

http.route({
  path: "/modal/complete",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const body = (await request.json().catch(() => ({}))) as { serviceSecret?: string; taskId?: string; result?: unknown };
    const valid = checkSecret(body, request.headers);
    if (!valid.ok) return jsonResponse(valid.body, valid.status);
    return jsonResponse({ ok: true, taskId: body.taskId ?? "", received: body.result }, 200);
  }),
});

export default http;
