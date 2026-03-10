"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { useHumeStream, getTimestampMsFromHumePayload } from "@/ux_telemetry";
import type { HumeEmotionMap, HumeStreamMessage } from "@/ux_telemetry";
import { cn } from "@/lib/utils";

type SandboxHumeTelemetryProps = {
  sandboxId: string;
  /** Optional session id for Convex telemetry writes. */
  sessionId?: string;
  /** Called when emotion data is received (e.g. for UI or Convex write). */
  onEmotionSample?: (
    emotions: HumeEmotionMap,
    raw: HumeStreamMessage,
  ) => void;
};

const EMOTION_MARGIN = 0.22;
const LOW_CONFIDENCE_DELAY_MS = 2000;
const HIGH_CONFIDENCE_DELAY_MS = 1000;
const PROB_THRESHOLD = 0.5;

export function emotionToDotColor(
  emotions: HumeEmotionMap,
): "green" | "yellow" | "red" {
  const entries = Object.entries(emotions);
  if (entries.length === 0) return "yellow";

  const positive = [
    "Joy",
    "Excitement",
    "Amusement",
    "Contentment",
    "Interest",
    "Admiration",
    "Love",
    "Relief",
  ];
  const negative = [
    "Anger",
    "Frustration",
    "Confusion",
    "Disgust",
    "Fear",
    "Distress",
    "Sadness",
    "Surprise",
  ];

  let posScore = 0;
  let negScore = 0;
  for (const [name, score] of entries) {
    if (positive.some((p) => name.toLowerCase().includes(p.toLowerCase())))
      posScore += score;
    if (negative.some((n) => name.toLowerCase().includes(n.toLowerCase())))
      negScore += score;
  }

  const diff = posScore - negScore;
  if (diff >= EMOTION_MARGIN) return "green";
  if (diff <= -EMOTION_MARGIN) return "red";
  return "yellow";
}

function getFaceConfidence(
  raw: HumeStreamMessage,
): { faceCount: number; maxProb: number } {
  type AnyObj = Record<string, unknown>;
  const face =
    (raw as AnyObj).face ??
    ((raw as AnyObj).models_success as AnyObj | undefined)?.face;
  const predictions = (face as AnyObj | undefined)?.predictions;
  if (!Array.isArray(predictions) || predictions.length === 0)
    return { faceCount: 0, maxProb: 0 };
  const maxProb = Math.max(
    ...predictions.map((p: AnyObj) =>
      typeof p.prob === "number" ? p.prob : 0,
    ),
  );
  return { faceCount: predictions.length, maxProb };
}

export function SandboxHumeTelemetry({
  sandboxId,
  sessionId,
  onEmotionSample,
}: SandboxHumeTelemetryProps) {
  const onEmotionSampleRef = useRef(onEmotionSample);
  onEmotionSampleRef.current = onEmotionSample;

  const insertHumeSample = useMutation(api.telemetry.insertHumeSample);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const [lowConfidence, setLowConfidence] = useState(false);
  const lowConfTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highConfTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMessage = useCallback(
    (emotions: HumeEmotionMap, raw: HumeStreamMessage) => {
      onEmotionSampleRef.current?.(emotions, raw);

      const sid = sessionIdRef.current;
      if (sid) {
        const timestampMs = getTimestampMsFromHumePayload(raw);
        insertHumeSample({
          sandboxId,
          sessionId: sid,
          timestampMs,
          rawPayload: raw,
        }).catch((e) => {
          if (process.env.NODE_ENV === "development") {
            console.warn("[SandboxHumeTelemetry] Convex insert failed:", e);
          }
        });
      }
    },
    [sandboxId, insertHumeSample],
  );

  const onRawMessage = useCallback((raw: HumeStreamMessage) => {
    // Skip API error payloads — they don't reflect face detection quality
    type AnyObj = Record<string, unknown>;
    const apiError =
      (raw as AnyObj).error ??
      ((raw as AnyObj).models_error as AnyObj | undefined)?.error;
    if (typeof apiError === "string") return;

    const { faceCount, maxProb } = getFaceConfidence(raw);
    const isLow = faceCount !== 1 || maxProb < PROB_THRESHOLD;

    if (isLow) {
      if (highConfTimerRef.current) {
        clearTimeout(highConfTimerRef.current);
        highConfTimerRef.current = null;
      }
      if (!lowConfTimerRef.current) {
        lowConfTimerRef.current = setTimeout(() => {
          setLowConfidence(true);
          lowConfTimerRef.current = null;
        }, LOW_CONFIDENCE_DELAY_MS);
      }
    } else {
      if (lowConfTimerRef.current) {
        clearTimeout(lowConfTimerRef.current);
        lowConfTimerRef.current = null;
      }
      if (!highConfTimerRef.current) {
        highConfTimerRef.current = setTimeout(() => {
          setLowConfidence(false);
          highConfTimerRef.current = null;
        }, HIGH_CONFIDENCE_DELAY_MS);
      }
    }
  }, []);

  const { start, stop, videoRef, status } = useHumeStream({
    maxFps: 2,
    onMessage,
    onRawMessage,
    onError: (e) => {
      // if (process.env.NODE_ENV === "development") {
      //   console.warn("[SandboxHumeTelemetry]", e.message);
      // }
      void e;
    },
    enabled: true,
    debug: process.env.NODE_ENV === "development",
  });

  const [mounted, setMounted] = useState(false);
  const startRef = useRef(start);
  const stopRef = useRef(stop);
  startRef.current = start;
  stopRef.current = stop;

  useEffect(() => {
    setMounted(true);
    const START_DELAY_MS = 300;
    const timeoutId = window.setTimeout(() => {
      startRef.current();
    }, START_DELAY_MS);
    return () => {
      window.clearTimeout(timeoutId);
      stopRef.current();
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const handleUnload = () => {
      stopRef.current();
    };
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, [mounted]);

  // Block scrolling when overlay is active
  useEffect(() => {
    if (!lowConfidence) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (e: WheelEvent) => e.preventDefault();
    document.addEventListener("wheel", handler, { passive: false });
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("wheel", handler);
    };
  }, [lowConfidence]);

  useEffect(() => {
    return () => {
      if (lowConfTimerRef.current) clearTimeout(lowConfTimerRef.current);
      if (highConfTimerRef.current) clearTimeout(highConfTimerRef.current);
    };
  }, []);

  if (!mounted) return null;

  const isStreaming =
    status === "streaming" ||
    status === "connecting" ||
    status === "requesting_media" ||
    status === "closed";

  return (
    <>
      {/* Always-mounted video — required for Hume frame capture */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          "fixed object-cover scale-x-[-1] rounded-2xl transition-all duration-500",
          lowConfidence
            ? "z-61 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] max-w-3xl border border-white/20 shadow-2xl opacity-100"
            : "top-0 left-0 w-px h-px opacity-0 pointer-events-none",
        )}
        style={{
          aspectRatio: "4/3",
          display: isStreaming ? undefined : "none",
        }}
        aria-hidden
      />

      {/* Low-confidence overlay */}
      <AnimatePresence>
        {lowConfidence && (
          <>
            <motion.div
              key="hume-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm"
            />
            <motion.p
              key="hume-text"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="fixed z-62 bottom-[10%] left-0 right-0 text-center text-white/80 text-sm pointer-events-none"
            >
              Please position yourself so your face is clearly visible
            </motion.p>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
