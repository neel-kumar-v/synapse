"use client";

import type { RefObject } from "react";

/** Emotion score from Hume Expression Measurement API (face model). */
export interface HumeEmotionScore {
  name: string;
  score: number;
}

/** Single face prediction (one entry in the predictions array). */
export interface HumeFacePrediction {
  emotions: HumeEmotionScore[];
  prob?: number;
  bbox?: { x: number; y: number; w: number; h: number };
}

/** Face model response: object with predictions array (Hume API shape). */
export interface HumeFaceResponse {
  predictions: HumeFacePrediction[];
}

export interface HumeStreamMessage {
  face?: HumeFaceResponse;
  [key: string]: unknown;
}

export type HumeEmotionMap = Record<string, number>;

export interface UseHumeStreamOptions {
  apiKey?: string;
  maxFps?: number;
  onMessage?: (emotions: HumeEmotionMap, raw: HumeStreamMessage) => void;
  onError?: (error: Error) => void;
  onRawMessage?: (raw: HumeStreamMessage) => void;
  enabled?: boolean;
  /** When true, log Hume message summaries to console (for debugging emotion/parsing). */
  debug?: boolean;
}

export interface UseHumeStreamReturn {
  status: "idle" | "requesting_media" | "connecting" | "streaming" | "error" | "closed";
  error: Error | null;
  start: () => Promise<void>;
  stop: () => void;
  videoRef: RefObject<HTMLVideoElement | null>;
}
