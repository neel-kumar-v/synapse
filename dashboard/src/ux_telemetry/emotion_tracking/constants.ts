"use client";

/** Direct Hume endpoint (requires X-Hume-Api-Key header; use proxy from browser). */
export const HUME_WS_BASE = "wss://api.hume.ai/v0/stream/models";

/** Path for same-origin WebSocket proxy (server adds X-Hume-Api-Key). Use in browser. */
export const HUME_WS_PROXY_PATH = "/ws/hume-stream";

export const HUME_MAX_FPS = 2;
export const HUME_FRAME_INTERVAL_MS = 1000 / HUME_MAX_FPS;

export const HUME_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 480 },
  height: { ideal: 360 },
  frameRate: { max: HUME_MAX_FPS },
};
