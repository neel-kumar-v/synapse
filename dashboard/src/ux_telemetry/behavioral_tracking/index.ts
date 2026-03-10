"use client";

export { initPostHog, isPostHogReady, captureEvent, getSessionReplayUrl, getDistinctId, isFrictionEvent } from "./posthog";
export type { PostHogConfig, PostHogCapturedEvent, PostHogEventName } from "./types";

