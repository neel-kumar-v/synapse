"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import {
  EMOTION_CATEGORY_COLORS,
  EMOTION_CATEGORY_LABELS,
  type EmotionCategory,
} from "@/lib/emotion-categories";
import { ReplayControlsOverlay } from "@/components/analytics/SessionReplayPlayer";

export type EmotionSample = {
  timestampMs: number;
  lowEnergyUnpleasant: number;
  lowEnergyPleasant: number;
  highEnergyPleasant: number;
  highEnergyUnpleasant: number;
};

const chartConfig: ChartConfig = {
  lowEnergyUnpleasant: { label: EMOTION_CATEGORY_LABELS.lowEnergyUnpleasant, color: EMOTION_CATEGORY_COLORS.lowEnergyUnpleasant },
  lowEnergyPleasant: { label: EMOTION_CATEGORY_LABELS.lowEnergyPleasant, color: EMOTION_CATEGORY_COLORS.lowEnergyPleasant },
  highEnergyPleasant: { label: EMOTION_CATEGORY_LABELS.highEnergyPleasant, color: EMOTION_CATEGORY_COLORS.highEnergyPleasant },
  highEnergyUnpleasant: { label: EMOTION_CATEGORY_LABELS.highEnergyUnpleasant, color: EMOTION_CATEGORY_COLORS.highEnergyUnpleasant },
  time: { label: "Time" },
};

type EmotionTimelineChartProps = {
  emotionSamples: EmotionSample[];
  sessionStartMs: number;
  sessionEndMs: number;
  playheadTimeMs: number;
  onPlayheadChange: (ms: number) => void;
  isPlaying?: boolean;
  playbackRate?: number;
  onPlayPauseToggle?: () => void;
  onSeekBack10?: () => void;
  onSeekForward10?: () => void;
  onPlaybackRateCycle?: () => void;
  /** Per-emotion score sums for the session (for tooltip sub-emotion). Optional. */
  emotionScores?: Record<string, number> | null;
};

type ChartCoreProps = {
  data: Array<EmotionSample & { timeSeconds: number }>;
  durationMs: number;
  playheadTimeSeconds: number;
  emotionScores?: Record<string, number> | null;
};

const EmotionChartCore = memo(function EmotionChartCore({
  data,
  durationMs,
  playheadTimeSeconds,
  emotionScores,
}: ChartCoreProps) {
  const tooltipContent = useCallback(
    (props: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number; color?: string; payload?: { timeSeconds?: number } }>; label?: number }) => {
      const { active, payload, label } = props;
      if (!active || !payload?.length) return null;
      const first = payload[0];
      const timeSeconds = typeof label === "number" ? label : (first && "payload" in first ? first.payload?.timeSeconds : undefined);
      const timeStr =
        timeSeconds != null
          ? `${Math.floor(timeSeconds / 60)}:${String(Math.floor(timeSeconds % 60)).padStart(2, "0")}`
          : "";
      const rows = payload
        .filter((p) => p.dataKey && chartConfig[p.dataKey as EmotionCategory])
        .map((p) => ({
          key: p.dataKey as EmotionCategory,
          value: typeof p.value === "number" ? p.value : 0,
          label: chartConfig[p.dataKey as EmotionCategory]?.label ?? p.dataKey,
          color: p.color,
        }))
        .sort((a, b) => b.value - a.value);
      return (
        <div className="z-30 min-w-[10rem] rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
          {timeStr && (
            <div className="mb-1.5 font-medium text-foreground">{timeStr}</div>
          )}
          <div className="grid gap-1">
            {rows.map((row) => {
              const pct = `${(row.value * 100).toFixed(0)}%`;
              return (
                <div key={row.key} className="flex w-full items-center justify-between gap-4">
                  {row.color != null && (
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px] border border-border"
                      style={{ backgroundColor: row.color, borderColor: row.color }}
                    />
                  )}
                  <span className="flex-1 text-muted-foreground">{row.label}</span>
                  <span className="font-mono font-medium tabular-nums text-foreground">{pct}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    },
    [],
  );

  return (
    <ChartContainer config={chartConfig} className="h-full w-full [&_.recharts-reference-line]:pointer-events-none">
      <AreaChart
        accessibilityLayer
        data={data}
        margin={{ left: 12, right: 12, top: 8, bottom: 8 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="timeSeconds"
          type="number"
          domain={[0, durationMs / 1000]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, "0")}`}
          className="text-xs"
        />
        <YAxis hide domain={[0, 1]} />
        <ChartTooltip cursor={false} content={tooltipContent as React.ComponentProps<typeof ChartTooltip>["content"]} />
        <ReferenceLine
          x={playheadTimeSeconds}
          stroke="var(--foreground)"
          strokeWidth={2}
          strokeOpacity={1}
          className="z-10"
        />
        <defs>
          <linearGradient id="fillHighEnergyPleasant" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-highEnergyPleasant)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-highEnergyPleasant)" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="fillLowEnergyPleasant" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-lowEnergyPleasant)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-lowEnergyPleasant)" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="fillLowEnergyUnpleasant" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-lowEnergyUnpleasant)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-lowEnergyUnpleasant)" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="fillHighEnergyUnpleasant" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-highEnergyUnpleasant)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-highEnergyUnpleasant)" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="highEnergyPleasant"
          fill="url(#fillHighEnergyPleasant)"
          fillOpacity={0.8}
          stroke="var(--color-highEnergyPleasant)"
          strokeWidth={1}
        />
        <Area
          type="monotone"
          dataKey="lowEnergyPleasant"
          fill="url(#fillLowEnergyPleasant)"
          fillOpacity={0.8}
          stroke="var(--color-lowEnergyPleasant)"
          strokeWidth={1}
        />
        <Area
          type="monotone"
          dataKey="lowEnergyUnpleasant"
          fill="url(#fillLowEnergyUnpleasant)"
          fillOpacity={0.8}
          stroke="var(--color-lowEnergyUnpleasant)"
          strokeWidth={1}
        />
        <Area
          type="monotone"
          dataKey="highEnergyUnpleasant"
          fill="url(#fillHighEnergyUnpleasant)"
          fillOpacity={0.8}
          stroke="var(--color-highEnergyUnpleasant)"
          strokeWidth={1}
        />
      </AreaChart>
    </ChartContainer>
  );
});

const CHART_BOTTOM_OFFSET_PX = 36;

function EmotionTimelineChartInner({
  emotionSamples,
  sessionStartMs,
  sessionEndMs,
  playheadTimeMs,
  onPlayheadChange,
  isPlaying = false,
  playbackRate = 1,
  onPlayPauseToggle,
  onSeekBack10,
  onSeekForward10,
  onPlaybackRateCycle,
  emotionScores,
}: EmotionTimelineChartProps) {
  const durationMs = Math.max(0, sessionEndMs - sessionStartMs);

  const SAMPLE_EVERY_N = 5;

  const fullData = useMemo(() => {
    return emotionSamples.map((s) => {
      const sum =
        s.lowEnergyUnpleasant +
        s.lowEnergyPleasant +
        s.highEnergyPleasant +
        s.highEnergyUnpleasant;
      const norm = sum > 0 ? sum : 1;
      return {
        timestampMs: s.timestampMs,
        lowEnergyUnpleasant: s.lowEnergyUnpleasant / norm,
        lowEnergyPleasant: s.lowEnergyPleasant / norm,
        highEnergyPleasant: s.highEnergyPleasant / norm,
        highEnergyUnpleasant: s.highEnergyUnpleasant / norm,
        timeSeconds: (s.timestampMs - sessionStartMs) / 1000,
      };
    });
  }, [emotionSamples, sessionStartMs]);

  const data = useMemo(() => {
    if (fullData.length <= SAMPLE_EVERY_N) return fullData;
    const sampled: typeof fullData = [];
    for (let i = 0; i < fullData.length; i++) {
      if (i % SAMPLE_EVERY_N === 0 || i === fullData.length - 1) {
        sampled.push(fullData[i]!);
      }
    }
    return sampled;
  }, [fullData]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverTimeSeconds, setHoverTimeSeconds] = useState<number | null>(null);
  const hoverTargetRef = useRef<number | null>(null);
  const hoverRafRef = useRef<number | null>(null);

  const handleChartMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = containerRef.current;
      if (!el || durationMs <= 0) return;
      const rect = el.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const target = fraction * (durationMs / 1000);
      hoverTargetRef.current = target;
      if (hoverRafRef.current === null) {
        hoverRafRef.current = requestAnimationFrame(() => {
          hoverRafRef.current = null;
          if (hoverTargetRef.current !== null) {
            setHoverTimeSeconds(hoverTargetRef.current);
          }
        });
      }
    },
    [durationMs],
  );

  const handleChartMouseLeave = useCallback(() => {
    hoverTargetRef.current = null;
    if (hoverRafRef.current !== null) {
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
    setHoverTimeSeconds(null);
  }, []);

  const handleChartClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = containerRef.current;
      if (!el || durationMs <= 0) return;
      const rect = el.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const ms = sessionStartMs + fraction * durationMs;
      onPlayheadChange(ms);
    },
    [durationMs, sessionStartMs, onPlayheadChange],
  );

  const playheadTimeSeconds = durationMs > 0 ? (playheadTimeMs - sessionStartMs) / 1000 : 0;

  if (data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
        No emotion data
      </div>
    );
  }

  const durationSeconds = durationMs / 1000;
  const hoverPercent = hoverTimeSeconds != null && durationSeconds > 0
    ? (hoverTimeSeconds / durationSeconds) * 100
    : null;

  const showOverlay =
    onPlayPauseToggle != null &&
    onSeekBack10 != null &&
    onSeekForward10 != null &&
    onPlaybackRateCycle != null;

  return (
    <div className="w-full h-full flex flex-col group">
      <div
        ref={containerRef}
        onClick={handleChartClick}
        onMouseMove={handleChartMouseMove}
        onMouseLeave={handleChartMouseLeave}
        className="flex-1 min-h-0 w-full relative cursor-crosshair"
      >
        <EmotionChartCore
          data={data}
          durationMs={durationMs}
          playheadTimeSeconds={playheadTimeSeconds}
          emotionScores={emotionScores ?? undefined}
        />
        {hoverPercent != null && (
          <div
            className="absolute left-0 right-0 top-0 pointer-events-none z-10"
            style={{ bottom: CHART_BOTTOM_OFFSET_PX }}
          >
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-foreground/35"
              style={{ left: `${hoverPercent}%`, transform: "translateX(-50%)" }}
            />
          </div>
        )}
        {showOverlay && (
          <ReplayControlsOverlay
            isPlaying={isPlaying}
            playbackRate={playbackRate}
            onPlayPauseToggle={onPlayPauseToggle}
            onSeekBack10={onSeekBack10}
            onSeekForward10={onSeekForward10}
            onPlaybackRateCycle={onPlaybackRateCycle}
            currentTimeMs={playheadTimeMs - sessionStartMs}
            durationMs={durationMs}
          />
        )}
      </div>
    </div>
  );
}

export const EmotionTimelineChart = memo(EmotionTimelineChartInner);
