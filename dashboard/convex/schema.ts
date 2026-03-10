import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  runs: defineTable({
    sandboxId: v.optional(v.string()),
    prompt: v.string(),
    output: v.string(),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  }),
  projects: defineTable({
    id: v.string(),
    userId: v.string(),
    name: v.string(),
    githubRepo: v.optional(v.string()),
    projectType: v.optional(v.string()),
    createdAt: v.number(),
    hidden: v.optional(v.boolean()),
  }).index("by_userId", ["userId"]),
  projectMembers: defineTable({
    projectId: v.string(),
    userId: v.string(),
    email: v.string(),
    invitedAt: v.optional(v.number()),
  })
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"])
    .index("by_projectId_userId", ["projectId", "userId"]),
  sandboxes: defineTable({
    id: v.string(),
    name: v.string(),
    createdAt: v.number(),
    lastOpenedAt: v.number(),
    projectId: v.optional(v.string()),
    testerEmail: v.optional(v.string()),
    testerUserId: v.optional(v.string()),
    testerName: v.optional(v.string()),
    githubRepo: v.optional(v.string()),
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
  })
    .index("by_lastOpenedAt", ["lastOpenedAt"])
    .index("by_sandbox_id", ["id"])
    .index("by_projectId", ["projectId"]),
  userEmails: defineTable({
    userId: v.string(),
    email: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"]),

  sandboxAnalyticsSessions: defineTable({
    sandboxId: v.string(),
    startedAt: v.number(),
    endedAt: v.number(),
    sessionReplayVideoUrl: v.optional(v.string()),
    supermemorySummary: v.optional(v.string()),
  }).index("by_sandboxId", ["sandboxId"]),

  sandboxTranscriptEntries: defineTable({
    sandboxId: v.string(),
    sessionId: v.optional(v.string()),
    timestampMs: v.number(),
    text: v.string(),
    isAiPrompt: v.boolean(),
    fromMic: v.optional(v.boolean()),
  }).index("by_sandboxId", ["sandboxId"]),

  sandboxAnalyticsStats: defineTable({
    sandboxId: v.string(),
    aiPromptCount: v.number(),
    linesChanged: v.number(),
    lastUpdated: v.number(),
  }).index("by_sandboxId", ["sandboxId"]),

  // Raw telemetry from sandbox sessions (Hume emotion, mouse tracking, voice, etc.).
  // Join streams by sandboxId + sessionId + timestampMs.
  telemetrySamples: defineTable({
    sandboxId: v.string(),
    sessionId: v.string(),
    timestampMs: v.number(),
    source: v.string(),
    payload: v.any(),
  })
    .index("by_sandboxId", ["sandboxId"])
    .index("by_sessionId", ["sessionId"])
    .index("by_sandboxId_sessionId_timestampMs", [
      "sandboxId",
      "sessionId",
      "timestampMs",
    ])
    .index("by_sandboxId_timestampMs", ["sandboxId", "timestampMs"]),
});

