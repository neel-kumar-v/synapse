"use client";

/**
 * Offline friction summary (for analysis only).
 *
 * We no longer run a live TelemetryProvider / friction loop during the
 * tester session. Instead, we log raw telemetry (Hume + mouse + PostHog)
 * with timestamps and can materialize this shape later in Convex or a
 * batch job when aggregating signals into a friction score.
 */
export interface FrictionPayload {
  trigger_source: "hume_biometric" | "posthog_behavioral";
  dominant_emotion: string;
  /** outerHTML of the element under the cursor (or nearest interactive). */
  target_element_html: string;
  session_replay_url: string;
  timestamp: number;
}
