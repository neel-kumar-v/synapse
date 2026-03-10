/**
 * Service authentication for Modal (or other external servers).
 *
 * Public functions here are callable over the Convex HTTP API without a user JWT.
 * Each function expects a shared secret (e.g. from MODAL_SERVICE_SECRET) in args
 * and validates it against the Convex env var before doing anything.
 *
 * Set MODAL_SERVICE_SECRET in the Convex dashboard (Settings → Environment Variables).
 * Store the same value in Modal Secrets so the Modal server can call these functions.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const SERVICE_SECRET_ENV = "MODAL_SERVICE_SECRET";

function validateServiceSecret(serviceSecret: string): void {
  const expected = process.env[SERVICE_SECRET_ENV];
  if (!expected || expected !== serviceSecret) {
    throw new Error("Invalid service secret");
  }
}

/**
 * Ping: verify Modal can reach Convex and the shared secret is correct.
 * Call via HTTP API: POST /api/query with path "modal:ping", args: { serviceSecret: "..." }.
 */
export const ping = query({
  args: { serviceSecret: v.string() },
  handler: async (_ctx, { serviceSecret }) => {
    validateServiceSecret(serviceSecret);
    return { ok: true, service: "convex", at: new Date().toISOString() };
  },
});

/**
 * Example: fetch tasks that need inference (e.g. summarize/translate).
 * Extend this to query your own tables; this returns an empty list as a stub.
 */
export const getInferenceTasks = query({
  args: { serviceSecret: v.string() },
  handler: async (ctx, { serviceSecret }) => {
    validateServiceSecret(serviceSecret);
    // TODO: query your tasks table, e.g. tasks where status === "pending" and type === "inference"
    return [] as { id: string; payload: unknown }[];
  },
});

/**
 * Example: mark an inference task complete and store the result.
 * Extend this to update your tasks table.
 */
export const completeInferenceTask = mutation({
  args: {
    serviceSecret: v.string(),
    taskId: v.string(),
    result: v.any(),
  },
  handler: async (ctx, { serviceSecret, taskId, result }) => {
    validateServiceSecret(serviceSecret);
    // TODO: update your task document: set status to "completed", store result, etc.
    return { ok: true, taskId, received: result };
  },
});
