import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const insertHumeSample = mutation({
  args: {
    sandboxId: v.string(),
    sessionId: v.string(),
    timestampMs: v.number(),
    rawPayload: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("telemetrySamples", {
      sandboxId: args.sandboxId,
      sessionId: args.sessionId,
      timestampMs: args.timestampMs,
      source: "hume",
      payload: args.rawPayload,
    });
  },
});

export const insertMouseSample = mutation({
  args: {
    sandboxId: v.string(),
    sessionId: v.string(),
    timestampMs: v.number(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("telemetrySamples", {
      sandboxId: args.sandboxId,
      sessionId: args.sessionId,
      timestampMs: args.timestampMs,
      source: "mouse",
      payload: args.payload,
    });
  },
});
