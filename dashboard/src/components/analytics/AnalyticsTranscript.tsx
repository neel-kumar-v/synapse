"use client";

import { useEffect, useRef } from "react";
import { Brain } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export type TranscriptEntry = {
  timestampMs: number;
  text: string;
  isAiPrompt: boolean;
  fromMic?: boolean;
};

type AnalyticsTranscriptProps = {
  entries: TranscriptEntry[];
  currentTimeMs: number;
  sessionStartMs: number;
  onSeek?: (timestampMs: number) => void;
};

function formatOffsetMs(offsetMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(offsetMs / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AnalyticsTranscript({ entries, currentTimeMs, sessionStartMs, onSeek }: AnalyticsTranscriptProps) {
  const currentIndex = entries.findIndex(
    (e, i) => {
      const next = entries[i + 1];
      if (!next) return currentTimeMs >= e.timestampMs;
      return currentTimeMs >= e.timestampMs && currentTimeMs < next.timestampMs;
    },
  );
  const activeIndex = currentIndex >= 0 ? currentIndex : entries.length - 1;
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <h3 className="text-sm font-medium px-3 py-2 border-b shrink-0">Transcript</h3>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-2">
          {entries.map((entry, i) => {
            const isCurrent = i === activeIndex;
            return (
              <button
                type="button"
                key={`${entry.timestampMs}-${i}`}
                ref={isCurrent ? currentRef : undefined}
                onClick={() => onSeek?.(entry.timestampMs)}
                className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors cursor-pointer hover:bg-muted/70 ${isCurrent ? "bg-accent/80" : "bg-muted/50"}`}
              >
                <span className="text-xs text-muted-foreground mr-2">
                  {formatOffsetMs(entry.timestampMs - sessionStartMs)}
                </span>
                {entry.text}
                {entry.isAiPrompt && (
                  <Brain className="inline-block size-3.5 ml-1.5 text-muted-foreground align-middle shrink-0" aria-label="AI prompt" />
                )}
              </button>
            );
          })}
          {entries.length === 0 && (
            <p className="text-muted-foreground text-sm">No transcript entries.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
