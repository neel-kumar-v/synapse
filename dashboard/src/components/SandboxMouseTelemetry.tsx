"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";

interface Props {
  sandboxId: string;
  sessionId: string;
}

const BATCH_INTERVAL_MS = 2000;
const MAX_BATCH_SIZE = 50;

/**
 * Listens for MOUSE_SNAPSHOT messages from the studio iframe and writes
 * them to Convex in batches. Mount this alongside the sandbox iframe.
 */
export function SandboxMouseTelemetry({ sandboxId, sessionId }: Props) {
  const insertSample = useMutation(api.telemetry.insertMouseSample);
  const bufferRef = useRef<Array<{ timestampMs: number; payload: unknown }>>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function flush() {
      const items = bufferRef.current.splice(0, MAX_BATCH_SIZE);
      for (const item of items) {
        insertSample({
          sandboxId,
          sessionId,
          timestampMs: item.timestampMs,
          payload: item.payload,
        }).catch(() => {});
      }
    }

    function onMessage(e: MessageEvent) {
      const d = e.data;
      if (!d || d.type !== "MOUSE_SNAPSHOT") return;
      bufferRef.current.push({
        timestampMs: typeof d.timestampMs === "number" ? d.timestampMs : Date.now(),
        payload: d.payload,
      });
      if (bufferRef.current.length >= MAX_BATCH_SIZE) flush();
    }

    window.addEventListener("message", onMessage);
    timerRef.current = setInterval(flush, BATCH_INTERVAL_MS);

    return () => {
      window.removeEventListener("message", onMessage);
      if (timerRef.current) clearInterval(timerRef.current);
      flush();
    };
  }, [sandboxId, sessionId, insertSample]);

  return null;
}
