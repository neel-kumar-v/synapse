"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { Play, Pause, RotateCcw, RotateCw } from "lucide-react";

const PLAYBACK_RATES = [0.5, 1, 1.5, 2] as const;

const POSTHOG_EMBED_ORIGIN = "https://us.posthog.com";
const POSTHOG_REPLAY_EMBED_ID = "IUAkhGVtGX24NOuA8nU7TMoE8621DQ";

function buildEmbedSrc(initialTimeSeconds: number): string {
  const base = `${POSTHOG_EMBED_ORIGIN}/embedded/${POSTHOG_REPLAY_EMBED_ID}`;
  return initialTimeSeconds > 0 ? `${base}?t=${initialTimeSeconds}` : base;
}

function postToReplayIframe(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  message: { type: string; action?: string; payload?: unknown }
) {
  try {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      { source: "posthog-replay-parent", ...message },
      POSTHOG_EMBED_ORIGIN
    );
  } catch {
    // cross-origin; ignore
  }
}

function formatTimeMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type ReplayControlsOverlayProps = {
  isPlaying: boolean;
  playbackRate: number;
  onPlayPauseToggle: () => void;
  onSeekBack10: () => void;
  onSeekForward10: () => void;
  onPlaybackRateCycle: () => void;
  /** Current time in the replay (ms from start). If set with durationMs, shows "current / total" in the left corner. */
  currentTimeMs?: number;
  /** Total duration of the replay in ms. */
  durationMs?: number;
};

export function ReplayControlsOverlay({
  isPlaying,
  playbackRate,
  onPlayPauseToggle,
  onSeekBack10,
  onSeekForward10,
  onPlaybackRateCycle,
  currentTimeMs,
  durationMs,
}: ReplayControlsOverlayProps) {
  const timeLabel =
    currentTimeMs != null && durationMs != null && durationMs > 0
      ? `${formatTimeMs(currentTimeMs)} / ${formatTimeMs(durationMs)}`
      : null;

  return (
    <div
      className="absolute inset-x-0 bottom-4 flex items-center justify-between px-4 transition-opacity duration-200 opacity-0 group-hover:opacity-100 pointer-events-none z-20"
    >
      <div className="min-w-[6rem] flex items-center justify-start">
        {timeLabel != null && (
          <span className="rounded-md bg-black/70 px-2.5 py-1.5 text-xs font-mono tabular-nums text-white pointer-events-auto">
            {timeLabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-black/70 px-3 py-2 pointer-events-auto">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSeekBack10();
          }}
          className="flex size-9 items-center justify-center rounded-md text-white hover:bg-white/20 transition-colors"
          aria-label="Back 10 seconds"
        >
          <RotateCcw className="size-5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPlayPauseToggle();
          }}
          className="flex size-9 items-center justify-center rounded-md text-white hover:bg-white/20 transition-colors"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="size-5" />
          ) : (
            <Play className="size-5 ml-0.5" />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSeekForward10();
          }}
          className="flex size-9 items-center justify-center rounded-md text-white hover:bg-white/20 transition-colors"
          aria-label="Forward 10 seconds"
        >
          <RotateCw className="size-5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPlaybackRateCycle();
          }}
          className="flex size-9 items-center justify-center rounded-md text-white hover:bg-white/20 transition-colors font-medium text-sm min-w-[2.25rem]"
          aria-label="Playback speed"
        >
          {playbackRate}x
        </button>
      </div>
      <div className="min-w-[6rem]" aria-hidden />
    </div>
  );
}

type SessionReplayPlayerProps = {
  sessionReplayVideoUrl?: string | null;
  currentTimeMs: number;
  sessionStartMs: number;
  sessionEndMs: number;
  isPlaying: boolean;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  onPlayPauseToggle: () => void;
  onSeekBack10: () => void;
  onSeekForward10: () => void;
};

export function SessionReplayPlayer({
  sessionReplayVideoUrl,
  currentTimeMs,
  sessionStartMs,
  sessionEndMs,
  isPlaying,
  playbackRate,
  onPlaybackRateChange,
  onPlayPauseToggle,
  onSeekBack10,
  onSeekForward10,
}: SessionReplayPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [embedStartTimeSeconds, setEmbedStartTimeSeconds] = useState(0);

  const timeSeconds = (currentTimeMs - sessionStartMs) / 1000;
  const durationSeconds = (sessionEndMs - sessionStartMs) / 1000;

  useEffect(() => {
    if (sessionReplayVideoUrl) setEmbedStartTimeSeconds(timeSeconds);
  }, [sessionReplayVideoUrl]); // only sync on session load, not on every timeSeconds change

  const cyclePlaybackRate = useCallback(() => {
    const idx = PLAYBACK_RATES.indexOf(playbackRate as (typeof PLAYBACK_RATES)[number]);
    const next = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
    onPlaybackRateChange(next);
    postToReplayIframe(iframeRef, {
      type: "posthog-replay-control",
      action: "setPlaybackRate",
      payload: { rate: next },
    });
  }, [playbackRate, onPlaybackRateChange]);

  const handlePlayPause = useCallback(() => {
    onPlayPauseToggle();
    postToReplayIframe(iframeRef, {
      type: "posthog-replay-control",
      action: isPlaying ? "pause" : "play",
    });
  }, [isPlaying, onPlayPauseToggle]);

  const handleSeekBack = useCallback(() => {
    onSeekBack10();
    const newTime = Math.max(0, timeSeconds - 10);
    setEmbedStartTimeSeconds(newTime);
    postToReplayIframe(iframeRef, {
      type: "posthog-replay-control",
      action: "seek",
      payload: { timeSeconds: newTime },
    });
  }, [onSeekBack10, timeSeconds]);

  const handleSeekForward = useCallback(() => {
    onSeekForward10();
    const newTime = Math.min(durationSeconds, timeSeconds + 10);
    setEmbedStartTimeSeconds(newTime);
    postToReplayIframe(iframeRef, {
      type: "posthog-replay-control",
      action: "seek",
      payload: { timeSeconds: newTime },
    });
  }, [onSeekForward10, durationSeconds, timeSeconds]);

  const overlay = (
    <ReplayControlsOverlay
      isPlaying={isPlaying}
      playbackRate={playbackRate}
      onPlayPauseToggle={handlePlayPause}
      onSeekBack10={handleSeekBack}
      onSeekForward10={handleSeekForward}
      onPlaybackRateCycle={cyclePlaybackRate}
    />
  );

  if (!sessionReplayVideoUrl) {
    return (
      <div className="group relative w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-sm">
        Session replay not available
        {overlay}
      </div>
    );
  }

  return (
    <div className="group relative w-full h-full bg-black">
      <iframe
        ref={iframeRef}
        src={buildEmbedSrc(embedStartTimeSeconds)}
        className="w-full h-full border-0"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
      {/* {overlay} */}
    </div>
  );
}
