"use client";

import { useHumeStream, useMouseTracker } from "@/ux_telemetry";
import type { HumeEmotionMap, HumeStreamMessage } from "@/ux_telemetry";
import { useCallback, useState } from "react";

function FaceStatus({
  emotions,
  lastRaw,
}: {
  emotions: HumeEmotionMap;
  lastRaw: HumeStreamMessage | null;
}) {
  const entries = Object.entries(emotions).sort((a, b) => b[1] - a[1]);
  const faceWarning = (() => {
    const warning = (lastRaw as unknown as { face?: { warning?: unknown } })?.face?.warning;
    return typeof warning === "string" ? warning : null;
  })();

  if (entries.length > 0) {
    return (
      <div className="text-left text-sm space-y-1">
        {entries.slice(0, 6).map(([name, score]) => (
          <div key={name} className="flex justify-between gap-4">
            <span className="font-medium text-slate-50">{name}</span>
            <span className="text-slate-400">{(score * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    );
  }
  if (faceWarning) {
    return (
      <p className="text-sm text-amber-400">
        {faceWarning} Move your face into frame and look at the camera.
      </p>
    );
  }
  return <span className="text-sm text-slate-400">Waiting for frames…</span>;
}

export default function HumeStreamTestPage() {
  const [lastEmotions, setLastEmotions] = useState<HumeEmotionMap>({});
  const [messageCount, setMessageCount] = useState(0);
  const [lastRaw, setLastRaw] = useState<HumeStreamMessage | null>(null);

  const onMessage = useCallback((emotions: HumeEmotionMap) => {
    setLastEmotions(emotions);
    setMessageCount((c) => c + 1);
  }, []);

  const { status, error, start, stop, videoRef } = useHumeStream({
    maxFps: 2,
    onMessage,
    onError: (e) => console.error("[Hume]", e),
    onRawMessage: setLastRaw,
    enabled: true,
  });

  const { snapshot: mouseSnapshot } = useMouseTracker({
    throttleMs: 100,
    enabled: true,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-50 md:text-xl">
          Hume stream test
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Allow webcam, click Start, and face the camera. If you see &quot;No
          faces detected&quot;, center your face in frame and use good lighting.
          Emotion scores update every ~500ms when a face is detected.
        </p>
      </div>

      <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-900 max-w-sm">
        <p className="text-xs text-slate-400 px-3 py-2 border-b border-slate-800">
          Camera preview (what Hume sees)
        </p>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full aspect-video object-cover scale-x-[-1]"
          style={{ display: status === "idle" || status === "closed" ? "none" : undefined }}
        />
        {(status === "idle" || status === "closed") && (
          <div className="aspect-video flex items-center justify-center text-slate-500 text-sm">
            Start to show camera
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => start()}
          disabled={
            status === "streaming" ||
            status === "requesting_media" ||
            status === "connecting"
          }
          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-sky-600"
        >
          Start
        </button>
        <button
          type="button"
          onClick={() => stop()}
          disabled={status === "idle" || status === "closed"}
          className="rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 disabled:opacity-50 hover:bg-slate-700"
        >
          Stop
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-50">Status</span>
          <span className="text-sm text-slate-400">{status}</span>
        </div>
        {error && (
          <p className="text-sm text-red-400">{error.message}</p>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-50">
            Messages received
          </span>
          <span className="text-sm text-slate-400">{messageCount}</span>
        </div>
        <div>
          <span className="text-sm font-medium text-slate-50 block mb-2">
            Last emotions
          </span>
          <FaceStatus emotions={lastEmotions} lastRaw={lastRaw} />
        </div>
        {lastRaw != null && (
          <details className="text-left">
            <summary className="text-sm font-medium text-slate-50 cursor-pointer">
              Last raw message (debug)
            </summary>
            <pre className="mt-2 p-2 rounded bg-slate-950 text-xs overflow-auto max-h-48 text-slate-300">
              {JSON.stringify(lastRaw, null, 2)}
            </pre>
          </details>
        )}
      </div>

      <details className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-left">
        <summary className="text-sm font-medium text-slate-50 cursor-pointer">
          Mouse tracker (element under cursor + intent)
        </summary>
        <div className="mt-3 space-y-2 text-sm text-slate-300">
          {mouseSnapshot ? (
            <>
              <p>
                Position: ({mouseSnapshot.position.x}, {mouseSnapshot.position.y})
              </p>
              <p>
                <span className="text-slate-400">Under cursor:</span>{" "}
                {mouseSnapshot.elementUnderCursor?.tagName ?? "—"}{" "}
                {mouseSnapshot.elementUnderCursor?.id
                  ? `#${mouseSnapshot.elementUnderCursor.id}`
                  : ""}
              </p>
              <p>
                <span className="text-slate-400">Interactive (intent):</span>{" "}
                {mouseSnapshot.interactiveElement?.tagName ?? "—"}{" "}
                {mouseSnapshot.interactiveElement?.id
                  ? `#${mouseSnapshot.interactiveElement.id}`
                  : ""}
              </p>
              <p className="text-xs text-slate-500">
                For FrictionPayload use interactive when you want &quot;what they
                meant to click&quot;, or elementUnderCursor for exact pixel.
              </p>
            </>
          ) : (
            <p className="text-slate-500">Move the mouse to see snapshot.</p>
          )}
        </div>
      </details>
    </div>
  );
}
