import { internalQuery, mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

export const getProjectById = internalQuery({
  args: { projectId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("id"), args.projectId))
      .first();
  },
});

function makeProjectId(): string {
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const listProjectsForUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = (identity as { subject?: string }).subject;
    if (!userId) return [];

    const owned = await ctx.db
      .query("projects")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const memberRows = await ctx.db
      .query("projectMembers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const memberProjectIds = new Set(memberRows.map((r) => r.projectId));
    const memberProjects: (Doc<"projects"> | null)[] = await Promise.all(
      Array.from(memberProjectIds).map(async (projectId) => {
        return await ctx.db
          .query("projects")
          .filter((q) => q.eq(q.field("id"), projectId))
          .first();
      }),
    );

    const all: Doc<"projects">[] = [...owned, ...memberProjects.filter((p): p is Doc<"projects"> => p != null)];
    const seen = new Set<string>();
    const deduped = all.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    return deduped
      .filter((p) => !p.hidden)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const updateProject = mutation({
  args: {
    projectId: v.string(),
    name: v.optional(v.string()),
    githubRepo: v.optional(v.union(v.string(), v.null())),
    projectType: v.optional(v.union(v.string(), v.null())),
    hidden: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Must be signed in");
    const userId = (identity as { subject?: string }).subject;
    if (!userId) throw new Error("Invalid identity");

    const project = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("id"), args.projectId))
      .first();
    if (!project) throw new Error("Project not found");
    if (project.userId !== userId) throw new Error("Only the project owner can update it");

    const updates: Partial<Doc<"projects">> = {};
    if (args.name !== undefined) updates.name = args.name.trim() || project.name;
    if (args.githubRepo !== undefined) updates.githubRepo = args.githubRepo ?? undefined;
    if (args.projectType !== undefined) updates.projectType = args.projectType ?? undefined;
    if (args.hidden !== undefined) updates.hidden = args.hidden;
    if (Object.keys(updates).length === 0) return null;

    await ctx.db.patch(project._id, updates);
    return null;
  },
});

export const removeProject = mutation({
  args: { projectId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Must be signed in");
    const userId = (identity as { subject?: string }).subject;
    if (!userId) throw new Error("Invalid identity");

    const project = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("id"), args.projectId))
      .first();
    if (!project) throw new Error("Project not found");
    if (project.userId !== userId) throw new Error("Only the project owner can delete it");

    await ctx.db.delete(project._id);
    return null;
  },
});

export const getProject = query({
  args: { projectId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = (identity as { subject?: string }).subject;
    if (!userId) return null;

    const project = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("id"), args.projectId))
      .first();
    if (!project) return null;
    if (project.userId === userId) return project;
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_projectId_userId", (q) =>
        q.eq("projectId", args.projectId).eq("userId", userId),
      )
      .first();
    return member ? project : null;
  },
});

export const createProject = mutation({
  args: {
    name: v.string(),
    githubRepo: v.optional(v.string()),
    projectType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Must be signed in to create a project");
    const userId = (identity as { subject?: string }).subject;
    if (!userId) throw new Error("Invalid identity");

    const id = makeProjectId();
    const now = Date.now();
    await ctx.db.insert("projects", {
      id,
      userId,
      name: args.name.trim() || "Untitled Project",
      githubRepo: args.githubRepo,
      projectType: args.projectType,
      createdAt: now,
    });
    return id;
  },
});

export const listProjectMembers = query({
  args: { projectId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = (identity as { subject?: string }).subject;
    if (!userId) return [];

    const project = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("id"), args.projectId))
      .first();
    if (!project) return [];
    if (project.userId !== userId) {
      const member = await ctx.db
        .query("projectMembers")
        .withIndex("by_projectId_userId", (q) =>
          q.eq("projectId", args.projectId).eq("userId", userId),
        )
        .first();
      if (!member) return [];
    }

    return await ctx.db
      .query("projectMembers")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const addProjectMember = mutation({
  args: {
    projectId: v.string(),
    email: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Must be signed in");
    const currentUserId = (identity as { subject?: string }).subject;
    if (!currentUserId) throw new Error("Invalid identity");

    const project = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("id"), args.projectId))
      .first();
    if (!project) throw new Error("Project not found");
    const isOwner = project.userId === currentUserId;
    if (!isOwner) {
      const member = await ctx.db
        .query("projectMembers")
        .withIndex("by_projectId_userId", (q) =>
          q.eq("projectId", args.projectId).eq("userId", currentUserId),
        )
        .first();
      if (!member) throw new Error("You do not have access to this project");
      throw new Error("Only the project owner can add members");
    }

    const existing = await ctx.db
      .query("projectMembers")
      .withIndex("by_projectId_userId", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.userId),
      )
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("projectMembers", {
      projectId: args.projectId,
      userId: args.userId,
      email: args.email.trim().toLowerCase(),
      invitedAt: Date.now(),
    });
  },
});

export const removeProjectMember = mutation({
  args: { projectId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Must be signed in");
    const currentUserId = (identity as { subject?: string }).subject;
    if (!currentUserId) throw new Error("Invalid identity");

    const project = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("id"), args.projectId))
      .first();
    if (!project) throw new Error("Project not found");
    if (project.userId !== currentUserId) {
      throw new Error("Only the project owner can remove members");
    }

    const row = await ctx.db
      .query("projectMembers")
      .withIndex("by_projectId_userId", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.userId),
      )
      .first();
    if (row) await ctx.db.delete(row._id);
    return null;
  },
});
