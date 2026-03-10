"use client";

import { useCallback, useRef, useState } from "react";
import { HUME_VIDEO_CONSTRAINTS, HUME_WS_PROXY_PATH } from "./constants";
import type {
  HumeEmotionMap,
  HumeStreamMessage,
  UseHumeStreamOptions,
  UseHumeStreamReturn,
} from "./types";

const DEFAULT_MAX_FPS = 2;

/** Server can send face at top level or under models_success. */
function getFacePayload(msg: HumeStreamMessage): HumeStreamMessage["face"] {
  return msg.face ?? (msg as { models_success?: { face?: HumeStreamMessage["face"] } }).models_success?.face;
}

/**
 * Extract timestamp in ms from a Hume stream payload for storage/analytics.
 * Uses payload time field when present, otherwise returns Date.now().
 */
export function getTimestampMsFromHumePayload(msg: HumeStreamMessage): number {
  const raw = msg as Record<string, unknown>;
  if (raw?.time != null) {
    const t = Number(raw.time);
    if (Number.isFinite(t)) return t < 1e12 ? t * 1000 : t;
  }
  if (raw?.timestamp_ms != null) {
    const t = Number((raw as { timestamp_ms: unknown }).timestamp_ms);
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}

function emotionsFromMessage(msg: HumeStreamMessage): HumeEmotionMap {
  const face = getFacePayload(msg);
  const predictions = face?.predictions;
  if (!Array.isArray(predictions)) return {};
  const out: HumeEmotionMap = {};
  for (const p of predictions) {
    if (!p?.emotions) continue;
    for (const e of p.emotions) {
      if (e.name != null && typeof e.score === "number") {
        out[e.name] = Math.max(out[e.name] ?? 0, e.score);
      }
    }
  }
  return out;
}

function buildHumeWsUrl(): string {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${HUME_WS_PROXY_PATH}`;
}

/**
 * Hume Expression Measurement WebSocket + webcam. For use in beta-tester
 * sandbox or dashboard; runs in the browser (getUserMedia + WebSocket).
 */
export function useHumeStream(
  options: UseHumeStreamOptions = {}
): UseHumeStreamReturn {
  const {
    maxFps = DEFAULT_MAX_FPS,
    onMessage,
    onError,
    onRawMessage,
    enabled = true,
    debug = false,
  } = options;

  const [status, setStatus] = useState<UseHumeStreamReturn["status"]>("idle");
  const [error, setError] = useState<Error | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startInProgressRef = useRef(false);
  const closingIntentionallyRef = useRef(false);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectCountRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  const stop = useCallback(() => {
    startInProgressRef.current = false;
    closingIntentionallyRef.current = true;
    if (reconnectTimeoutRef.current != null) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectCountRef.current = 0;
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (wsRef.current != null) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    if (streamRef.current != null) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video?.srcObject) {
      video.srcObject = null;
    }
    if (canvasRef.current != null) {
      canvasRef.current = null;
    }
    setStatus("closed");
    setError(null);
  }, []);

  const start = useCallback(async () => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (startInProgressRef.current) return;

    startInProgressRef.current = true;
    stop();

    setStatus("requesting_media");
    setError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: HUME_VIDEO_CONSTRAINTS,
        audio: false,
      });
    } catch (e) {
      startInProgressRef.current = false;
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      setStatus("error");
      onError?.(err);
      return;
    }

    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) {
      startInProgressRef.current = false;
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const err = new Error(
        "useHumeStream: attach videoRef to a <video> element before calling start()."
      );
      setError(err);
      setStatus("error");
      onError?.(err);
      return;
    }

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Video failed to load metadata"));
        if (video.readyState >= 1) resolve();
      });
    } catch (e) {
      startInProgressRef.current = false;
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      setStatus("error");
      onError?.(err);
      return;
    }

    setStatus("connecting");

    const fps = Math.min(
      Math.max(maxFps > 0 ? maxFps : DEFAULT_MAX_FPS, 0.5),
      DEFAULT_MAX_FPS
    );
    const frameIntervalMs = Math.ceil(1000 / fps);

    const wsUrl = buildHumeWsUrl();
    if (!wsUrl) {
      startInProgressRef.current = false;
      const err = new Error("useHumeStream: WebSocket URL not available (missing window).");
      setError(err);
      setStatus("error");
      onError?.(err);
      return;
    }

    const faceConfig = {
      identify_faces: false,
      fps_pred: Math.min(maxFps, DEFAULT_MAX_FPS),
      prob_threshold: 0.5,
      min_face_size: 40,
    };

    /** Send a single config-only message to initialize the Hume stream (required by API). */
    const sendConfigOnly = (socket: WebSocket) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      try {
        socket.send(JSON.stringify({ models: { face: faceConfig } }));
      } catch {
        /* ignore */
      }
    };

    const startSendInterval = (socket: WebSocket) => {
      let canvas = canvasRef.current;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvasRef.current = canvas;
      }
      const c = canvas;
      intervalRef.current = setInterval(() => {
        if (socket.readyState !== WebSocket.OPEN) return;
        const v = videoRef.current;
        if (!v || v.readyState < 2) return;
        const w = v.videoWidth;
        const h = v.videoHeight;
        if (w === 0 || h === 0) return;
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
        const ctx = c.getContext("2d", { alpha: false, desynchronized: true });
        if (!ctx) return;
        ctx.drawImage(v, 0, 0);
        try {
          const dataUrl = c.toDataURL("image/jpeg", 0.85);
          const base64 = dataUrl.split(",")[1];
          if (base64) {
            socket.send(
              JSON.stringify({ models: { face: faceConfig }, data: base64 })
            );
          }
        } catch {
          /* skip frame */
        }
      }, frameIntervalMs);
    };

    const processParsedMessage = (raw: HumeStreamMessage) => {
      // if (debug && typeof console !== "undefined" && console.log) {
      //   const face = getFacePayload(raw);
      //   const emotions = emotionsFromMessage(raw);
      //   const keys = Object.keys(raw).filter((k) => k !== "face" && k !== "models_success");
      //   console.log(
      //     "[Hume]",
      //     "topKeys:",
      //     keys.concat(face ? ["face"] : []),
      //     "predictions:",
      //     face?.predictions?.length ?? 0,
      //     "emotions:",
      //     Object.keys(emotions).length ? emotions : "(none)"
      //   );
      // }
      onRawMessage?.(raw);
      const apiError =
        (raw as { error?: string }).error ??
        (raw as { models_error?: { error?: string } }).models_error?.error;
      if (typeof apiError === "string") {
        const err = new Error(`Hume: ${apiError}`);
        setError(err);
        setStatus("error");
        onError?.(err);
        return;
      }
      const emotions = emotionsFromMessage(raw);
      if (Object.keys(emotions).length > 0) {
        onMessage?.(emotions, raw);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      // if (debug && typeof console !== "undefined" && console.log) {
      //   const t = event.data;
      //   console.log("[Hume] message received", typeof t, t instanceof Blob ? "Blob" : t instanceof ArrayBuffer ? "ArrayBuffer" : "");
      // }
      const parseAndProcess = (text: string) => {
        let raw: HumeStreamMessage;
        try {
          raw = JSON.parse(text) as HumeStreamMessage;
        } catch (e) {
          // if (debug && typeof console !== "undefined" && console.log) {
          //   console.log("[Hume] parse failed", text?.slice?.(0, 200));
          // }
          return;
        }
        processParsedMessage(raw);
      };

      const data = event.data;
      if (typeof data === "string") {
        parseAndProcess(data);
        return;
      }
      if (data instanceof Blob) {
        data.text().then(parseAndProcess).catch(() => {
          // if (debug && typeof console !== "undefined" && console.log) {
          //   console.log("[Hume] Blob.text() failed");
          // }
        });
        return;
      }
      if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        const text = new TextDecoder().decode(data);
        parseAndProcess(text);
        return;
      }
    };

    const scheduleReconnect = () => {
      if (
        closingIntentionallyRef.current ||
        !streamRef.current ||
        reconnectTimeoutRef.current != null ||
        reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS
      )
        return;
      const attempt = reconnectCountRef.current;
      reconnectCountRef.current += 1;
      const delayMs = 2000 * Math.pow(2, Math.min(attempt, 4));
      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectTimeoutRef.current = null;
        const url = buildHumeWsUrl();
        if (!url || !streamRef.current) return;
        closingIntentionallyRef.current = false;
        const ws2 = new WebSocket(url);
        wsRef.current = ws2;
        ws2.onopen = () => {
          reconnectCountRef.current = 0;
          setStatus("streaming");
          setError(null);
          sendConfigOnly(ws2);
          window.setTimeout(() => {
            if (ws2.readyState === WebSocket.OPEN) startSendInterval(ws2);
          }, 300);
        };
        ws2.onmessage = handleMessage;
        ws2.onerror = () => {
          setError(new Error("Hume WebSocket error"));
          setStatus("error");
          onError?.(new Error("Hume WebSocket error"));
        };
        ws2.onclose = () => {
          if (intervalRef.current != null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setStatus("closed");
          scheduleReconnect();
        };
      }, delayMs);
    };

    closingIntentionallyRef.current = false;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      startInProgressRef.current = false;
      setStatus("streaming");
      sendConfigOnly(ws);
      window.setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) startSendInterval(ws);
      }, 500);
    };

    ws.onmessage = handleMessage;

    ws.onerror = () => {
      startInProgressRef.current = false;
      setError(new Error("Hume WebSocket error"));
      setStatus("error");
      onError?.(new Error("Hume WebSocket error"));
    };

    ws.onclose = () => {
      startInProgressRef.current = false;
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setStatus("closed");
      scheduleReconnect();
    };
  }, [enabled, maxFps, onMessage, onError, onRawMessage, stop, debug]);

  return {
    status,
    error,
    start,
    stop,
    videoRef,
  };
}
