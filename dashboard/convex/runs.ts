import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const logRun = mutation({
  args: {
    sandboxId: v.optional(v.string()),
    prompt: v.string(),
    output: v.string(),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("runs", {
      sandboxId: args.sandboxId,
      prompt: args.prompt,
      output: args.output,
      success: args.success,
      errorMessage: args.errorMessage,
    });
    return null;
  },
});

export const getRecentRuns = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const take =
      args.limit && args.limit > 0 && args.limit <= 100 ? args.limit : 20;
    const runs = await ctx.db.query("runs").order("desc").take(take);
    return runs;
  },
});

