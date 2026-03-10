"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { SandboxVoice } from "@/components/SandboxVoice";
import {
  SandboxHumeTelemetry,
  emotionToDotColor,
} from "@/components/SandboxHumeTelemetry";
import { SandboxMouseTelemetry } from "@/components/SandboxMouseTelemetry";
import { startMouseTracking, stopMouseTracking } from "@/lib/sandboxMouseTracking";
import { Loader2 } from "lucide-react";
import type { HumeEmotionMap } from "@/ux_telemetry";

function useSandboxSessionId(): string {
  const ref = useRef<string | null>(null);
  if (ref.current === null) {
    ref.current =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
  return ref.current;
}

const WORKER_BASE_URL =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_WORKER_BASE_URL
    : undefined;

export default function SandboxPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const sessionId = useSandboxSessionId();
  const workerBase = WORKER_BASE_URL ?? "";

  const onSandboxFrameLoad = useCallback(() => {
    if (id && sessionId) startMouseTracking(id, sessionId);
  }, [id, sessionId]);

  const sandbox = useQuery(
    api.sandboxes.getSandboxForCurrentUser,
    id ? { sandboxId: id } : "skip",
  );
  const ensureSandboxOnWorker = useAction(api.sandboxes.ensureSandboxOnWorker);
  const [workerReady, setWorkerReady] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [emotionColor, setEmotionColor] = useState<"green" | "yellow" | "red">("yellow");

  const handleEmotionSample = useCallback((emotions: HumeEmotionMap) => {
    setEmotionColor(emotionToDotColor(emotions));
  }, []);

  const cachedSandboxRef = useRef<{ id: string; value: unknown } | null>(null);
  if (sandbox !== undefined && id) {
    cachedSandboxRef.current = { id, value: sandbox };
  }
  const resolvedSandbox =
    sandbox !== undefined
      ? sandbox
      : id && cachedSandboxRef.current?.id === id
        ? cachedSandboxRef.current.value
        : undefined;

  // Stop mouse tracking when tab is hidden or component unmounts.
  useEffect(() => {
    if (typeof window === "undefined" || !id) return;
    const onVisChange = () => {
      if (document.visibilityState === "hidden") stopMouseTracking();
    };
    const onPageHide = () => stopMouseTracking();
    document.addEventListener("visibilitychange", onVisChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisChange);
      window.removeEventListener("pagehide", onPageHide);
      stopMouseTracking();
    };
  }, [id]);

  useEffect(() => {
    if (!id || !sandbox || workerReady || workerError) return;
    let cancelled = false;
    ensureSandboxOnWorker({ sandboxId: id })
      .then(() => {
        if (!cancelled) setWorkerReady(true);
      })
      .catch((err) => {
        if (!cancelled)
          setWorkerError(err instanceof Error ? err.message : "Failed to start sandbox");
      });
    return () => {
      cancelled = true;
    };
  }, [id, sandbox, ensureSandboxOnWorker, workerReady, workerError]);

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Invalid sandbox.
      </div>
    );
  }

  if (!workerBase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground p-6">
        <p>
          Set{" "}
          <code className="font-mono text-foreground">
            NEXT_PUBLIC_WORKER_BASE_URL
          </code>{" "}
          so the sandbox can load.
        </p>
      </div>
    );
  }

  if (resolvedSandbox === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="size-8 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (resolvedSandbox === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground p-6">
        <p className="text-center">Access denied. This sandbox is not assigned to you.</p>
      </div>
    );
  }

  if (workerError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground p-6">
        <p className="text-center text-destructive">{workerError}</p>
      </div>
    );
  }

  if (!workerReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="size-8 animate-spin" aria-label="Starting sandbox" />
      </div>
    );
  }

  const iframeSrc = `${workerBase.replace(/\/$/, "")}/s/${id}/`;

  return (
    <>
      <iframe
        id="sandboxFrame"
        src={iframeSrc}
        className="w-full h-screen border-0"
        title={`Sandbox ${id}`}
        onLoad={onSandboxFrameLoad}
      />
      <SandboxVoice sandboxId={id} emotionColor={emotionColor} />
      <SandboxHumeTelemetry
        sandboxId={id}
        sessionId={sessionId}
        onEmotionSample={handleEmotionSample}
      />
      <SandboxMouseTelemetry sandboxId={id} sessionId={sessionId} />
    </>
  );
}
