import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Call from client after sign-in to sync current user's email for the share combobox.
 */
export const upsertUserEmail = mutation({
  args: { userId: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Must be signed in");
    const currentUserId = (identity as { subject?: string }).subject;
    if (!currentUserId || currentUserId !== args.userId) {
      throw new Error("Can only set your own email");
    }
    const email = args.email.trim().toLowerCase();
    if (!email) return null;

    const existing = await ctx.db
      .query("userEmails")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { email });
      return existing._id;
    }
    return await ctx.db.insert("userEmails", {
      userId: args.userId,
      email,
    });
  },
});

/**
 * List user emails by prefix for the share combobox (only emails that exist in user table).
 */
export const listUserEmailsByPrefix = query({
  args: { prefix: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const all = await ctx.db.query("userEmails").collect();
    const p = (args.prefix ?? "").trim().toLowerCase();
    if (!p) return all.map((r) => ({ userId: r.userId, email: r.email }));
    return all
      .filter((r) => r.email.startsWith(p) || r.email.includes(p))
      .map((r) => ({ userId: r.userId, email: r.email }));
  },
});
