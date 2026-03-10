"use client";

/**
 * UX Telemetry — client-only, for the beta-tester sandbox (runs in tester's browser).
 *
 * - emotion_tracking: Hume AI webcam stream (useHumeStream)
 * - mouse_tracking: throttled cursor + intent with radius (useMouseTracker)
 */

export { useHumeStream, getTimestampMsFromHumePayload } from "./emotion_tracking";
export {
  HUME_FRAME_INTERVAL_MS,
  HUME_MAX_FPS,
  HUME_VIDEO_CONSTRAINTS,
  HUME_WS_BASE,
} from "./emotion_tracking";
export type {
  HumeEmotionMap,
  HumeEmotionScore,
  HumeFacePrediction,
  HumeFaceResponse,
  HumeStreamMessage,
  UseHumeStreamOptions,
  UseHumeStreamReturn,
} from "./emotion_tracking";

export { useMouseTracker } from "./mouse_tracking";
export type {
  MouseTargetSnapshot,
  MouseTrackingSnapshot,
  UseMouseTrackerOptions,
  UseMouseTrackerReturn,
} from "./mouse_tracking";

export type { FrictionPayload } from "./types";
