import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { EMOTION_TO_QUADRANT, getQuadrant } from "./emotionCategories";
import type { Quadrant } from "./emotionCategories";

/** Default PostHog session replay embed URL used when seeding analytics. */
const DEFAULT_POSTHOG_REPLAY_EMBED_URL =
  "https://us.posthog.com/embedded/IUAkhGVtGX24NOuA8nU7TMoE8621DQ";

/** Shared transcript entries for seeding. Theme: user perusing a friend's dev portfolio, commenting (non-AI) and asking for changes (AI), with big pauses between chunks. */
const TRANSCRIPT_TEXTS: { text: string; isAiPrompt: boolean }[] = [
  { text: "Oh, so this is Jake's portfolio. Let me scroll and see what he's got.", isAiPrompt: false },
  { text: "The hero section is kind of busy. I don't love that font.", isAiPrompt: false },
  { text: "Can you simplify the hero — simpler headline, less going on?", isAiPrompt: true },
  { text: "Projects are way down here. Took me a second to find them.", isAiPrompt: false },
  { text: "Add a nav link that jumps straight to the projects section.", isAiPrompt: true },
  { text: "The project cards all look the same. Hard to tell what's what.", isAiPrompt: false },
  { text: "Give each project card a different accent or icon so they're easier to scan.", isAiPrompt: true },
  { text: "Hmm. The contact section feels cramped.", isAiPrompt: false },
  { text: "Add more spacing in the contact section and make the inputs bigger.", isAiPrompt: true },
  { text: "Okay, that's better. Still not crazy about the green.", isAiPrompt: false },
  { text: "Switch the accent color from green to a warm blue or teal.", isAiPrompt: true },
  { text: "Alright, I'll send him some notes. Good enough for a first pass.", isAiPrompt: false },
];

/** All Hume emotion names (must match EMOTION_TO_QUADRANT so categorization and pie tooltips work). */
const ALL_HUME_EMOTION_NAMES = Object.keys(EMOTION_TO_QUADRANT) as string[];

/** Build a Hume-format payload matching real API shape: face.predictions[0] with bbox, emotions (all 42), face_id, frame, prob, time. */
function buildHumePayload(weights: Record<Quadrant, number>): Record<string, unknown> {
  const quadrants: Quadrant[] = ["pleasantHighEnergy", "pleasantLowEnergy", "unpleasantLowEnergy", "unpleasantHighEnergy"];
  const countByQuadrant: Record<Quadrant, number> = {
    pleasantHighEnergy: 0,
    pleasantLowEnergy: 0,
    unpleasantLowEnergy: 0,
    unpleasantHighEnergy: 0,
  };
  for (const name of ALL_HUME_EMOTION_NAMES) {
    const q = getQuadrant(name);
    countByQuadrant[q] = (countByQuadrant[q] ?? 0) + 1;
  }
  const rawScores: Record<string, number> = {};
  for (const name of ALL_HUME_EMOTION_NAMES) {
    const q = getQuadrant(name);
    const count = countByQuadrant[q] ?? 1;
    const base = (weights[q] ?? 0) / count;
    rawScores[name] = base * (0.6 + Math.random() * 0.8);
  }
  const rawSums: Record<Quadrant, number> = {
    pleasantHighEnergy: 0,
    pleasantLowEnergy: 0,
    unpleasantLowEnergy: 0,
    unpleasantHighEnergy: 0,
  };
  for (const name of ALL_HUME_EMOTION_NAMES) {
    const q = getQuadrant(name);
    rawSums[q] = (rawSums[q] ?? 0) + rawScores[name];
  }
  const emotions: Array<{ name: string; score: number }> = ALL_HUME_EMOTION_NAMES.map((name) => {
    const q = getQuadrant(name);
    const raw = rawScores[name];
    const sum = rawSums[q];
    const score = sum > 0 ? (raw / sum) * (weights[q] ?? 0) : 0;
    return { name, score };
  });
  return {
    face: {
      predictions: [
        {
          bbox: { h: 151.59, w: 111.57, x: 225.23, y: 137.16 },
          emotions,
          face_id: "unknown",
          frame: 0,
          prob: 0.999,
          time: null,
        },
      ],
    },
  };
}

/** Seed mouse payload format (matches client MouseTrackingSnapshot). */
function buildMousePayload(
  x: number,
  y: number,
  underTag: string,
  underId: string | null,
  interactiveTag: string,
  interactiveId: string | null
): Record<string, unknown> {
  return {
    position: { x, y },
    elementUnderCursor: { tagName: underTag, id: underId ?? undefined, outerHTML: `<${underTag}>` },
    interactiveElement: { tagName: interactiveTag, id: interactiveId ?? undefined, outerHTML: `<${interactiveTag}>` },
  };
}

async function userCanAccessSandbox(ctx: QueryCtx, sandboxId: string): Promise<boolean> {
  const row = await ctx.db
    .query("sandboxes")
    .filter((q) => q.eq(q.field("id"), sandboxId))
    .first();
  if (!row) return false;
  if (!row.projectId) return true;
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  const userId = (identity as { subject?: string }).subject;
  if (!userId) return false;
  const project = await ctx.db
    .query("projects")
    .filter((q) => q.eq(q.field("id"), row.projectId))
    .first();
  if (!project) return false;
  if (project.userId === userId) return true;
  const member = await ctx.db
    .query("projectMembers")
    .withIndex("by_projectId_userId", (q) =>
      q.eq("projectId", row.projectId!).eq("userId", userId),
    )
    .first();
  return !!member;
}

/** True if any telemetry exists for this sandbox (so we show analytics layout and do not prompt to seed). */
export const getHasTelemetryForSandbox = query({
  args: { sandboxId: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const canAccess = await userCanAccessSandbox(ctx, args.sandboxId);
    if (!canAccess) return false;
    const one = await ctx.db
      .query("telemetrySamples")
      .withIndex("by_sandboxId", (q) => q.eq("sandboxId", args.sandboxId))
      .first();
    return one != null;
  },
});

export const getSessionForSandbox = query({
  args: { sandboxId: v.string(), sessionId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const canAccess = await userCanAccessSandbox(ctx, args.sandboxId);
    if (!canAccess) return null;
    const sessions = await ctx.db
      .query("sandboxAnalyticsSessions")
      .withIndex("by_sandboxId", (q) => q.eq("sandboxId", args.sandboxId))
      .collect();
    if (sessions.length === 0) return null;
    const session = args.sessionId
      ? sessions.find((s) => s._id === args.sessionId) ?? sessions[0]
      : sessions.sort((a, b) => b.endedAt - a.endedAt)[0];
    return session;
  },
});

type EmotionSampleFromTelemetry = {
  timestampMs: number;
  pleasantHighEnergy: number;
  pleasantLowEnergy: number;
  unpleasantLowEnergy: number;
  unpleasantHighEnergy: number;
};

function parseHumePayloadToQuadrantSums(payload: unknown): Record<Quadrant, number> {
  const sums: Record<Quadrant, number> = {
    pleasantHighEnergy: 0,
    pleasantLowEnergy: 0,
    unpleasantLowEnergy: 0,
    unpleasantHighEnergy: 0,
  };
  if (!payload || typeof payload !== "object" || !("face" in payload)) return sums;
  const pl = payload as Record<string, unknown>;
  const face = pl.face as Record<string, unknown> | undefined;
  const predictions = face?.predictions;
  if (!Array.isArray(predictions)) return sums;
  for (const p of predictions) {
    const pred = p as Record<string, unknown>;
    const emotions = pred?.emotions;
    if (!Array.isArray(emotions)) continue;
    for (const e of emotions) {
      const em = e as Record<string, unknown>;
      const name = em?.name;
      const score = em?.score;
      if (name != null && typeof name === "string" && typeof score === "number") {
        const q = getQuadrant(name);
        sums[q] = (sums[q] ?? 0) + score;
      }
    }
  }
  return sums;
}

function normalizeQuadrantSums(sums: Record<Quadrant, number>): Record<Quadrant, number> {
  const total = sums.pleasantHighEnergy + sums.pleasantLowEnergy + sums.unpleasantLowEnergy + sums.unpleasantHighEnergy;
  if (total <= 0) {
    return {
      pleasantHighEnergy: 0.25,
      pleasantLowEnergy: 0.25,
      unpleasantLowEnergy: 0.25,
      unpleasantHighEnergy: 0.25,
    };
  }
  return {
    pleasantHighEnergy: sums.pleasantHighEnergy / total,
    pleasantLowEnergy: sums.pleasantLowEnergy / total,
    unpleasantLowEnergy: sums.unpleasantLowEnergy / total,
    unpleasantHighEnergy: sums.unpleasantHighEnergy / total,
  };
}

/** Parse Hume payload into per-emotion score sums (max per emotion across predictions). */
function parseHumePayloadToEmotionScores(payload: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!payload || typeof payload !== "object" || !("face" in payload)) return out;
  const pl = payload as Record<string, unknown>;
  const face = pl.face as Record<string, unknown> | undefined;
  const predictions = face?.predictions;
  if (!Array.isArray(predictions)) return out;
  for (const p of predictions) {
    const pred = p as Record<string, unknown>;
    const emotions = pred?.emotions;
    if (!Array.isArray(emotions)) continue;
    for (const e of emotions) {
      const em = e as Record<string, unknown>;
      const name = em?.name;
      const score = em?.score;
      if (name != null && typeof name === "string" && typeof score === "number") {
        out[name] = Math.max(out[name] ?? 0, score);
      }
    }
  }
  return out;
}

/** Per-emotion score sums for the session (for pie tooltip breakdown). */
export const getEmotionScoresFromTelemetry = query({
  args: { sandboxId: v.string(), sessionId: v.string() },
  handler: async (ctx, args): Promise<Record<string, number>> => {
    const canAccess = await userCanAccessSandbox(ctx, args.sandboxId);
    if (!canAccess) return {};
    const rows = await ctx.db
      .query("telemetrySamples")
      .withIndex("by_sandboxId", (q) => q.eq("sandboxId", args.sandboxId))
      .collect();
    const filtered = rows.filter(
      (r) => r.sessionId === args.sessionId && r.source === "hume"
    );
    const aggregated: Record<string, number> = {};
    for (const r of filtered) {
      const scores = parseHumePayloadToEmotionScores(r.payload);
      for (const [name, score] of Object.entries(scores)) {
        aggregated[name] = (aggregated[name] ?? 0) + score;
      }
    }
    return aggregated;
  },
});

export const getEmotionSamplesFromTelemetry = query({
  args: { sandboxId: v.string(), sessionId: v.string() },
  handler: async (ctx, args): Promise<EmotionSampleFromTelemetry[]> => {
    const canAccess = await userCanAccessSandbox(ctx, args.sandboxId);
    if (!canAccess) return [];
    const rows = await ctx.db
      .query("telemetrySamples")
      .withIndex("by_sandboxId", (q) => q.eq("sandboxId", args.sandboxId))
      .collect();
    const filtered = rows.filter(
      (r) => r.sessionId === args.sessionId && r.source === "hume"
    );
    const sorted = filtered.sort((a, b) => a.timestampMs - b.timestampMs);
    return sorted.map((r) => {
      const sums = parseHumePayloadToQuadrantSums(r.payload);
      const norm = normalizeQuadrantSums(sums);
      return {
        timestampMs: r.timestampMs,
        pleasantHighEnergy: norm.pleasantHighEnergy,
        pleasantLowEnergy: norm.pleasantLowEnergy,
        unpleasantLowEnergy: norm.unpleasantLowEnergy,
        unpleasantHighEnergy: norm.unpleasantHighEnergy,
      };
    });
  },
});

export type ClickDataStats = {
  topUnderCursorTag: string;
  topUnderCursorTagCount: number;
  topUnderCursorId: string;
  topUnderCursorIdCount: number;
  topInteractiveTag: string;
  topInteractiveTagCount: number;
  topInteractiveId: string;
  topInteractiveIdCount: number;
  intentMismatchCount: number;
  totalSamples: number;
};

function parseMousePayload(payload: unknown): {
  elementUnderCursor?: { tagName?: string; id?: string | null };
  interactiveElement?: { tagName?: string; id?: string | null };
} {
  if (!payload || typeof payload !== "object") return {};
  const p = payload as Record<string, unknown>;
  return {
    elementUnderCursor: p.elementUnderCursor as { tagName?: string; id?: string | null } | undefined,
    interactiveElement: p.interactiveElement as { tagName?: string; id?: string | null } | undefined,
  };
}

export const getClickDataStats = query({
  args: { sandboxId: v.string(), sessionId: v.string() },
  handler: async (ctx, args): Promise<ClickDataStats | null> => {
    const canAccess = await userCanAccessSandbox(ctx, args.sandboxId);
    if (!canAccess) return null;
    const rows = await ctx.db
      .query("telemetrySamples")
      .withIndex("by_sandboxId", (q) => q.eq("sandboxId", args.sandboxId))
      .collect();
    const mouseRows = rows.filter(
      (r) => r.sessionId === args.sessionId && r.source === "mouse"
    );
    if (mouseRows.length === 0) {
      return {
        topUnderCursorTag: "—",
        topUnderCursorTagCount: 0,
        topUnderCursorId: "—",
        topUnderCursorIdCount: 0,
        topInteractiveTag: "—",
        topInteractiveTagCount: 0,
        topInteractiveId: "—",
        topInteractiveIdCount: 0,
        intentMismatchCount: 0,
        totalSamples: 0,
      };
    }
    const tagUnderCount: Record<string, number> = {};
    const idUnderCount: Record<string, number> = {};
    const tagInteractiveCount: Record<string, number> = {};
    const idInteractiveCount: Record<string, number> = {};
    let intentMismatchCount = 0;
    for (const r of mouseRows) {
      const { elementUnderCursor: uc, interactiveElement: ie } = parseMousePayload(r.payload);
      const ucTag = uc?.tagName?.trim() || "—";
      const ucId = uc?.id?.trim() || "(no id)";
      const ieTag = ie?.tagName?.trim() || "—";
      const ieId = ie?.id?.trim() || "(no id)";
      tagUnderCount[ucTag] = (tagUnderCount[ucTag] ?? 0) + 1;
      idUnderCount[ucId] = (idUnderCount[ucId] ?? 0) + 1;
      tagInteractiveCount[ieTag] = (tagInteractiveCount[ieTag] ?? 0) + 1;
      idInteractiveCount[ieId] = (idInteractiveCount[ieId] ?? 0) + 1;
      if (ie && (uc?.tagName !== ie?.tagName || (uc?.id ?? null) !== (ie?.id ?? null))) {
        intentMismatchCount += 1;
      }
    }
    const topUnderTag = Object.entries(tagUnderCount).reduce((a, b) => (a[1] >= b[1] ? a : b), ["—", 0]);
    const topUnderId = Object.entries(idUnderCount).reduce((a, b) => (a[1] >= b[1] ? a : b), ["—", 0]);
    const topIeTag = Object.entries(tagInteractiveCount).reduce((a, b) => (a[1] >= b[1] ? a : b), ["—", 0]);
    const topIeId = Object.entries(idInteractiveCount).reduce((a, b) => (a[1] >= b[1] ? a : b), ["—", 0]);
    return {
      topUnderCursorTag: topUnderTag[0],
      topUnderCursorTagCount: topUnderTag[1],
      topUnderCursorId: topUnderId[0],
      topUnderCursorIdCount: topUnderId[1],
      topInteractiveTag: topIeTag[0],
      topInteractiveTagCount: topIeTag[1],
      topInteractiveId: topIeId[0],
      topInteractiveIdCount: topIeId[1],
      intentMismatchCount,
      totalSamples: mouseRows.length,
    };
  },
});

export type MissedClickRow = {
  timestampMs: number;
  underCursorTag: string;
  underCursorId: string;
  targetTag: string;
  targetId: string;
};

/** List of intent-mismatch events (cursor on one element, intent on another) for the session. */
export const getMissedClicks = query({
  args: { sandboxId: v.string(), sessionId: v.string() },
  handler: async (ctx, args): Promise<MissedClickRow[]> => {
    const canAccess = await userCanAccessSandbox(ctx, args.sandboxId);
    if (!canAccess) return [];
    const rows = await ctx.db
      .query("telemetrySamples")
      .withIndex("by_sandboxId", (q) => q.eq("sandboxId", args.sandboxId))
      .collect();
    const mouseRows = rows.filter(
      (r) => r.sessionId === args.sessionId && r.source === "mouse"
    );
    const out: MissedClickRow[] = [];
    for (const r of mouseRows) {
      const { elementUnderCursor: uc, interactiveElement: ie } = parseMousePayload(r.payload);
      if (!ie) continue;
      const ucTag = uc?.tagName?.trim() || "—";
      const ucId = uc?.id?.trim() ?? "(no id)";
      const ieTag = ie?.tagName?.trim() || "—";
      const ieId = ie?.id?.trim() ?? "(no id)";
      if (ucTag !== ieTag || ucId !== ieId) {
        out.push({
          timestampMs: r.timestampMs,
          underCursorTag: ucTag,
          underCursorId: ucId,
          targetTag: ieTag,
          targetId: ieId,
        });
      }
    }
    return out.sort((a, b) => a.timestampMs - b.timestampMs);
  },
});

export const getTranscript = query({
  args: { sandboxId: v.string(), sessionId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const canAccess = await userCanAccessSandbox(ctx, args.sandboxId);
    if (!canAccess) return [];
    const entries = await ctx.db
      .query("sandboxTranscriptEntries")
      .withIndex("by_sandboxId", (q) => q.eq("sandboxId", args.sandboxId))
      .collect();
    const filtered = args.sessionId
      ? entries.filter((e) => e.sessionId === args.sessionId)
      : entries;
    return filtered.sort((a, b) => a.timestampMs - b.timestampMs);
  },
});

export const getStatsForSandbox = query({
  args: { sandboxId: v.string() },
  handler: async (ctx, args) => {
    const canAccess = await userCanAccessSandbox(ctx, args.sandboxId);
    if (!canAccess) return null;
    return await ctx.db
      .query("sandboxAnalyticsStats")
      .withIndex("by_sandboxId", (q) => q.eq("sandboxId", args.sandboxId))
      .first();
  },
});

/**
 * Insert a single transcript entry (e.g. from ElevenLabs STT). Requires sandbox access.
 */
export const insertTranscriptEntry = mutation({
  args: {
    sandboxId: v.string(),
    timestampMs: v.number(),
    text: v.string(),
    sessionId: v.optional(v.string()),
    isAiPrompt: v.optional(v.boolean()),
    fromMic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const canAccess = await userCanAccessSandboxMutation(ctx, args.sandboxId);
    if (!canAccess) throw new Error("You do not have access to this sandbox");
    await ctx.db.insert("sandboxTranscriptEntries", {
      sandboxId: args.sandboxId,
      sessionId: args.sessionId,
      timestampMs: args.timestampMs,
      text: args.text,
      isAiPrompt: args.isAiPrompt ?? false,
      fromMic: args.fromMic ?? false,
    });
  },
});

/**
 * Start a voice/transcript session for a sandbox. Call when the user first produces
 * a committed transcript in a visit. Returns the session id to pass to insertTranscriptEntry.
 */
export const startVoiceSession = mutation({
  args: { sandboxId: v.string() },
  handler: async (ctx, args) => {
    const canAccess = await userCanAccessSandboxMutation(ctx, args.sandboxId);
    if (!canAccess) throw new Error("You do not have access to this sandbox");
    const now = Date.now();
    const sessionId = await ctx.db.insert("sandboxAnalyticsSessions", {
      sandboxId: args.sandboxId,
      startedAt: now,
      endedAt: now,
    });
    return sessionId;
  },
});

/**
 * End a voice session (set endedAt to now). Call when the user leaves the sandbox
 * or stops the voice session so the analytics timeline has a correct duration.
 */
export const endVoiceSession = mutation({
  args: { sessionId: v.id("sandboxAnalyticsSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return;
    const canAccess = await userCanAccessSandboxMutation(ctx, session.sandboxId);
    if (!canAccess) throw new Error("You do not have access to this session");
    await ctx.db.patch(args.sessionId, { endedAt: Date.now() });
  },
});

/**
 * Seeds analytics data for a sandbox (1fps emotion samples, transcript, session, stats).
 * Call from dashboard or Convex dashboard for a given sandboxId.
 */
export const seedAnalyticsForSandbox = internalMutation({
  args: {
    sandboxId: v.string(),
    sessionDurationSeconds: v.optional(v.number()),
    sessionReplayVideoUrl: v.optional(v.string()),
    supermemorySummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const durationSec = args.sessionDurationSeconds ?? 120; // 2 minutes
    const startedAt = Date.now() - durationSec * 1000;
    const endedAt = Date.now();

    const sessionId = await ctx.db.insert("sandboxAnalyticsSessions", {
      sandboxId: args.sandboxId,
      startedAt,
      endedAt,
      sessionReplayVideoUrl: args.sessionReplayVideoUrl ?? DEFAULT_POSTHOG_REPLAY_EMBED_URL,
      supermemorySummary:
        args.supermemorySummary ??
        "User explored the sandbox, made several UI changes, and used AI to refine the layout. Key moments included adding a sidebar and adjusting colors.",
    });

    const startMs = startedAt;
    const sessionIdStr = sessionId as unknown as string;

    const segmentDurationMs = (endedAt - startMs) / TRANSCRIPT_TEXTS.length;
    TRANSCRIPT_TEXTS.forEach((item, i) => {
      ctx.db.insert("sandboxTranscriptEntries", {
        sandboxId: args.sandboxId,
        sessionId: sessionIdStr,
        timestampMs: Math.floor(startMs + i * segmentDurationMs),
        text: item.text,
        isAiPrompt: item.isAiPrompt,
        fromMic: false,
      });
    });

    const existingStats = await ctx.db
      .query("sandboxAnalyticsStats")
      .withIndex("by_sandboxId", (q) => q.eq("sandboxId", args.sandboxId))
      .first();

    const aiPromptCount = TRANSCRIPT_TEXTS.filter((t) => t.isAiPrompt).length;
    const lastUpdated = Date.now();
    if (existingStats) {
      await ctx.db.patch(existingStats._id, {
        aiPromptCount,
        linesChanged: 42,
        lastUpdated,
      });
    } else {
      await ctx.db.insert("sandboxAnalyticsStats", {
        sandboxId: args.sandboxId,
        aiPromptCount,
        linesChanged: 42,
        lastUpdated,
      });
    }

    return { sessionId, transcriptCount: TRANSCRIPT_TEXTS.length };
  },
});

async function userCanAccessSandboxMutation(ctx: MutationCtx, sandboxId: string): Promise<boolean> {
  const row = await ctx.db
    .query("sandboxes")
    .filter((q) => q.eq(q.field("id"), sandboxId))
    .first();
  if (!row) return false;
  if (!row.projectId) return true;
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  const userId = (identity as { subject?: string }).subject;
  if (!userId) return false;
  const project = await ctx.db
    .query("projects")
    .filter((q) => q.eq(q.field("id"), row.projectId))
    .first();
  if (!project) return false;
  if (project.userId === userId) return true;
  const member = await ctx.db
    .query("projectMembers")
    .withIndex("by_projectId_userId", (q) =>
      q.eq("projectId", row.projectId!).eq("userId", userId),
    )
    .first();
  return !!member;
}

/** Light bias from phases (used only as a small blend so data is still highly variable). */
const EMOTION_PHASES: Array<Record<Quadrant, number>> = [
  { pleasantHighEnergy: 0.05, pleasantLowEnergy: 0.75, unpleasantLowEnergy: 0.15, unpleasantHighEnergy: 0.05 },
  { pleasantHighEnergy: 0.08, pleasantLowEnergy: 0.72, unpleasantLowEnergy: 0.12, unpleasantHighEnergy: 0.08 },
  { pleasantHighEnergy: 0.06, pleasantLowEnergy: 0.35, unpleasantLowEnergy: 0.48, unpleasantHighEnergy: 0.11 },
  { pleasantHighEnergy: 0.12, pleasantLowEnergy: 0.68, unpleasantLowEnergy: 0.12, unpleasantHighEnergy: 0.08 },
  { pleasantHighEnergy: 0.52, pleasantLowEnergy: 0.28, unpleasantLowEnergy: 0.10, unpleasantHighEnergy: 0.10 },
];

/** Random weights for one sample: large per-sample variation so the chart fluctuates. */
function randomQuadrantWeights(
  phaseProgress: number
): Record<Quadrant, number> {
  const quadrants: Quadrant[] = ["pleasantHighEnergy", "pleasantLowEnergy", "unpleasantLowEnergy", "unpleasantHighEnergy"];
  const phaseIndex = Math.max(0, Math.min(phaseProgress * (EMOTION_PHASES.length - 1), EMOTION_PHASES.length - 1));
  const phaseLo = Math.floor(phaseIndex);
  const phaseHi = Math.min(phaseLo + 1, EMOTION_PHASES.length - 1);
  const blend = phaseIndex - phaseLo;
  const weights: Record<Quadrant, number> = {
    pleasantHighEnergy: 0,
    pleasantLowEnergy: 0,
    unpleasantLowEnergy: 0,
    unpleasantHighEnergy: 0,
  };
  for (const q of quadrants) {
    const a = EMOTION_PHASES[phaseLo]![q] ?? 0.25;
    const b = EMOTION_PHASES[phaseHi]![q] ?? 0.25;
    const phaseVal = a * (1 - blend) + b * blend;
    const randomVal = 0.15 + 0.75 * Math.random();
    weights[q] = phaseVal * 0.15 + randomVal * 0.85;
  }
  const total = quadrants.reduce((s, q) => s + weights[q], 0);
  if (total > 0) {
    for (const q of quadrants) weights[q] = weights[q] / total;
  } else {
    for (const q of quadrants) weights[q] = 0.25;
  }
  return weights;
}

/** Modular: seed only emotion (Hume) telemetry for a session window. */
async function seedEmotionSamplesForSession(
  ctx: MutationCtx,
  sandboxId: string,
  sessionIdStr: string,
  startMs: number,
  endMs: number
): Promise<void> {
  const durationMs = endMs - startMs;
  const emotionStepMs = 1000;
  const numEmotionSamples = Math.max(1, Math.floor(durationMs / emotionStepMs) + 1);
  for (let i = 0; i < numEmotionSamples; i++) {
    const t = Math.min(i * emotionStepMs, durationMs);
    const timestampMs = startMs + t;
    const phaseProgress = numEmotionSamples <= 1 ? 0 : i / (numEmotionSamples - 1);
    const weights = randomQuadrantWeights(phaseProgress);
    const payload = buildHumePayload(weights);
    await ctx.db.insert("telemetrySamples", {
      sandboxId,
      sessionId: sessionIdStr,
      timestampMs,
      source: "hume",
      payload,
    });
  }
}

/** Modular: seed only mouse (click) telemetry for a session window. */
async function seedMouseSamplesForSession(
  ctx: MutationCtx,
  sandboxId: string,
  sessionIdStr: string,
  startMs: number,
  endMs: number
): Promise<void> {
  const durationMs = endMs - startMs;
  const mouseTags = ["BUTTON", "DIV", "A", "SPAN", "INPUT", "BUTTON", "DIV"];
  const mouseIds = [
    "checkout-btn",
    "login-btn",
    "submit-btn",
    "nav",
    "main",
    "search-input",
    "cancel-btn",
    "save-btn",
    "add-to-cart",
    "user-menu",
    "sidebar-toggle",
  ];
  const mouseStepMs = 2000;
  for (let t = 0; t <= durationMs; t += mouseStepMs) {
    const timestampMs = startMs + t;
    const tagIdx = Math.floor(Math.random() * mouseTags.length);
    const idIdx = Math.floor(Math.random() * mouseIds.length);
    const underTag = mouseTags[tagIdx]!;
    const underId = mouseIds[idIdx]!;
    const mismatch = Math.random() < 0.38;
    const interactiveTag = mismatch
      ? (underTag === "BUTTON" ? "DIV" : "BUTTON")
      : underTag;
    const interactiveId = mismatch
      ? mouseIds[(idIdx + 1) % mouseIds.length]!
      : underId;
    const x = 100 + Math.random() * 600;
    const y = 80 + Math.random() * 400;
    const payload = buildMousePayload(x, y, underTag, underId, interactiveTag, interactiveId);
    await ctx.db.insert("telemetrySamples", {
      sandboxId,
      sessionId: sessionIdStr,
      timestampMs,
      source: "mouse",
      payload,
    });
  }
}

/** Modular: seed only transcript entries for a session. */
async function seedTranscriptForSession(
  ctx: MutationCtx,
  sandboxId: string,
  sessionIdStr: string,
  startMs: number,
  endMs: number
): Promise<number> {
  const segmentMs =
    TRANSCRIPT_TEXTS.length <= 1 ? 0 : (endMs - startMs) / (TRANSCRIPT_TEXTS.length - 1);
  for (let i = 0; i < TRANSCRIPT_TEXTS.length; i++) {
    const item = TRANSCRIPT_TEXTS[i]!;
    const timestampMs =
      TRANSCRIPT_TEXTS.length <= 1
        ? startMs
        : Math.round(startMs + i * segmentMs);
    await ctx.db.insert("sandboxTranscriptEntries", {
      sandboxId,
      sessionId: sessionIdStr,
      timestampMs,
      text: item.text,
      isAiPrompt: item.isAiPrompt,
      fromMic: false,
    });
  }
  return TRANSCRIPT_TEXTS.length;
}

/** Modular: seed or update sandbox stats (e.g. after transcript seed). */
async function seedStatsForSandbox(
  ctx: MutationCtx,
  sandboxId: string,
  aiPromptCount: number
): Promise<void> {
  const lastUpdated = Date.now();
  const existingStats = await ctx.db
    .query("sandboxAnalyticsStats")
    .withIndex("by_sandboxId", (q) => q.eq("sandboxId", sandboxId))
    .first();
  if (existingStats) {
    await ctx.db.patch(existingStats._id, {
      aiPromptCount,
      linesChanged: 42,
      lastUpdated,
    });
  } else {
    await ctx.db.insert("sandboxAnalyticsStats", {
      sandboxId,
      aiPromptCount,
      linesChanged: 42,
      lastUpdated,
    });
  }
}

/** Public mutation to seed analytics. When fillMissingOnly is true, only seeds what is missing (e.g. emotions if only clicks exist, or clicks if only emotions exist). */
export const seedAnalytics = mutation({
  args: {
    sandboxId: v.string(),
    sessionDurationSeconds: v.optional(v.number()),
    fillMissingOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const canAccess = await userCanAccessSandboxMutation(ctx, args.sandboxId);
    if (!canAccess) throw new Error("You do not have access to this sandbox");
    const durationSec = args.sessionDurationSeconds ?? 9 * 60; // 9 minutes
    const fillMissingOnly = args.fillMissingOnly ?? false;

    if (fillMissingOnly) {
      const sessions = await ctx.db
        .query("sandboxAnalyticsSessions")
        .withIndex("by_sandboxId", (q) => q.eq("sandboxId", args.sandboxId))
        .collect();
      const existingSession = sessions.sort((a, b) => b.endedAt - a.endedAt)[0];
      let sessionIdStr: string;
      let startMs: number;
      let endMs: number;
      if (existingSession) {
        sessionIdStr = existingSession._id as unknown as string;
        startMs = existingSession.startedAt;
        endMs = existingSession.endedAt;
      } else {
        const startedAt = Date.now() - durationSec * 1000;
        const endedAt = Date.now();
        const sessionId = await ctx.db.insert("sandboxAnalyticsSessions", {
          sandboxId: args.sandboxId,
          startedAt,
          endedAt,
          sessionReplayVideoUrl: DEFAULT_POSTHOG_REPLAY_EMBED_URL,
          supermemorySummary:
            "User explored the sandbox, made several UI changes, and used AI to refine the layout. Key moments included adding a sidebar and adjusting colors.",
        });
        sessionIdStr = sessionId as unknown as string;
        startMs = startedAt;
        endMs = endedAt;
      }

      const allTelemetry = await ctx.db
        .query("telemetrySamples")
        .withIndex("by_sandboxId", (q) => q.eq("sandboxId", args.sandboxId))
        .collect();
      const hasHume = allTelemetry.some(
        (r) => r.sessionId === sessionIdStr && r.source === "hume"
      );
      const hasMouse = allTelemetry.some(
        (r) => r.sessionId === sessionIdStr && r.source === "mouse"
      );

      if (!hasHume) {
        await seedEmotionSamplesForSession(
          ctx,
          args.sandboxId,
          sessionIdStr,
          startMs,
          endMs
        );
      }
      if (!hasMouse) {
        await seedMouseSamplesForSession(
          ctx,
          args.sandboxId,
          sessionIdStr,
          startMs,
          endMs
        );
      }

      const transcriptEntries = await ctx.db
        .query("sandboxTranscriptEntries")
        .withIndex("by_sandboxId", (q) => q.eq("sandboxId", args.sandboxId))
        .collect();
      const hasTranscript = transcriptEntries.some((e) => e.sessionId === sessionIdStr);
      let aiPromptCount = TRANSCRIPT_TEXTS.filter((t) => t.isAiPrompt).length;
      if (!hasTranscript) {
        await seedTranscriptForSession(
          ctx,
          args.sandboxId,
          sessionIdStr,
          startMs,
          endMs
        );
      } else {
        aiPromptCount = transcriptEntries
          .filter((e) => e.sessionId === sessionIdStr && e.isAiPrompt)
          .length;
      }

      const hasStats = (await ctx.db
        .query("sandboxAnalyticsStats")
        .withIndex("by_sandboxId", (q) => q.eq("sandboxId", args.sandboxId))
        .first()) != null;
      if (!hasStats) {
        await seedStatsForSandbox(ctx, args.sandboxId, aiPromptCount);
      }

      return { filled: true };
    }

    const startedAt = Date.now() - durationSec * 1000;
    const endedAt = Date.now();
    const sessionId = await ctx.db.insert("sandboxAnalyticsSessions", {
      sandboxId: args.sandboxId,
      startedAt,
      endedAt,
      sessionReplayVideoUrl: DEFAULT_POSTHOG_REPLAY_EMBED_URL,
      supermemorySummary:
        "User explored the sandbox, made several UI changes, and used AI to refine the layout. Key moments included adding a sidebar and adjusting colors.",
    });
    const startMs = startedAt;
    const endMs = endedAt;
    const sessionIdStr = sessionId as unknown as string;

    await seedEmotionSamplesForSession(
      ctx,
      args.sandboxId,
      sessionIdStr,
      startMs,
      endMs
    );
    await seedMouseSamplesForSession(
      ctx,
      args.sandboxId,
      sessionIdStr,
      startMs,
      endMs
    );
    await seedTranscriptForSession(
      ctx,
      args.sandboxId,
      sessionIdStr,
      startMs,
      endMs
    );
    const aiPromptCount = TRANSCRIPT_TEXTS.filter((t) => t.isAiPrompt).length;
    await seedStatsForSandbox(ctx, args.sandboxId, aiPromptCount);

    return { sessionId, transcriptCount: TRANSCRIPT_TEXTS.length };
  },
});
