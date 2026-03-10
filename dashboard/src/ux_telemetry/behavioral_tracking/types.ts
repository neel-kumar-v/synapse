"use client";

export type PostHogEventName =
  | "$autocapture"
  | "$rageclick"
  | "$dead_click"
  | "$exception"
  | (string & {});

/** Minimal shape of PostHog capture result we care about for realtime signals. */
export interface PostHogCapturedEvent {
  name: PostHogEventName;
  properties?: Record<string, unknown>;
  uuid?: string;
  timestamp?: string;
}

export interface PostHogConfig {
  /** PostHog project API key. If omitted, NEXT_PUBLIC_POSTHOG_KEY is used. */
  apiKey?: string;
  /** PostHog host, e.g. https://us.i.posthog.com or your self-hosted URL. */
  apiHost?: string;
  /** Enable session replay (default true). */
  enableSessionReplay?: boolean;
  /** Enable cross-origin iframe recording (default false). */
  recordCrossOriginIframes?: boolean;
  /** Called when PostHog autocapture emits a $rageclick. */
  onRageClick?: (event: PostHogCapturedEvent) => void;
  /** Called for every captured event (realtime behavioral signals). */
  onEventCaptured?: (event: PostHogCapturedEvent) => void;
}

