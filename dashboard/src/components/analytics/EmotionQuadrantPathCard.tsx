"use client";

import { memo, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EMOTION_CATEGORY_COLORS,
  QUADRANT_LABELS,
  type Quadrant,
} from "@/lib/emotion-categories";

/** Quadrant → chart color (legacy category keys). */
const QUADRANT_COLOR: Record<Quadrant, string> = {
  pleasantHighEnergy: EMOTION_CATEGORY_COLORS.highEnergyPleasant,
  pleasantLowEnergy: EMOTION_CATEGORY_COLORS.lowEnergyPleasant,
  unpleasantLowEnergy: EMOTION_CATEGORY_COLORS.lowEnergyUnpleasant,
  unpleasantHighEnergy: EMOTION_CATEGORY_COLORS.highEnergyUnpleasant,
};

export type QuadrantSample = {
  timestampMs: number;
  pleasantHighEnergy: number;
  pleasantLowEnergy: number;
  unpleasantLowEnergy: number;
  unpleasantHighEnergy: number;
};

type EmotionQuadrantPathCardProps = {
  emotionSamples: QuadrantSample[];
  sessionStartMs: number;
  sessionEndMs: number;
  playheadTimeMs: number;
};

/** Map quadrant values to a 2D point: x = pleasant→unpleasant (-1 to 1), y = low→high energy (-1 to 1). */
function sampleToPoint(s: QuadrantSample): { x: number; y: number } {
  const pleasant = s.pleasantHighEnergy + s.pleasantLowEnergy;
  const unpleasant = s.unpleasantLowEnergy + s.unpleasantHighEnergy;
  const high = s.pleasantHighEnergy + s.unpleasantHighEnergy;
  const low = s.pleasantLowEnergy + s.unpleasantLowEnergy;
  const x = unpleasant - pleasant;
  const y = high - low;
  return { x, y };
}

/** Top 3 quadrants by value at this sample. */
function top3Quadrants(s: QuadrantSample): { q: Quadrant; value: number }[] {
  const order: Quadrant[] = [
    "pleasantHighEnergy",
    "pleasantLowEnergy",
    "unpleasantLowEnergy",
    "unpleasantHighEnergy",
  ];
  return order
    .map((q) => ({ q, value: s[q] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
}

const PAD = 40;
const AXIS_LABEL = 18;
const SVG_SIZE = 320;

function EmotionQuadrantPathCardInner({
  emotionSamples,
  sessionStartMs,
  sessionEndMs,
  playheadTimeMs,
}: EmotionQuadrantPathCardProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const durationMs = Math.max(0, sessionEndMs - sessionStartMs);
  const graphSize = SVG_SIZE - 2 * PAD - AXIS_LABEL;

  const { pathD, points, playheadIndex, bounds } = useMemo(() => {
    if (emotionSamples.length === 0)
      return {
        pathD: "",
        points: [] as { x: number; y: number; index: number }[],
        playheadIndex: -1,
        bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
      };
    const pts = emotionSamples.map((s, i) => ({
      ...sampleToPoint(s),
      index: i,
    }));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const padX = Math.max(0.1, (maxX - minX) * 0.1) || 0.2;
    const padY = Math.max(0.1, (maxY - minY) * 0.1) || 0.2;
    const rangeX = maxX - minX + 2 * padX || 1;
    const rangeY = maxY - minY + 2 * padY || 1;
    const scaleX = (v: number) =>
      PAD + AXIS_LABEL + ((v - (minX - padX)) / rangeX) * graphSize;
    const scaleY = (v: number) =>
      PAD + graphSize - ((v - (minY - padY)) / rangeY) * graphSize;
    const scaled = pts.map((p) => ({
      x: scaleX(p.x),
      y: scaleY(p.y),
      index: p.index,
    }));
    const d = scaled
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(" ");
    let playheadIndex = -1;
    if (durationMs > 0 && emotionSamples.length > 0) {
      const t = (playheadTimeMs - sessionStartMs) / durationMs;
      const i = Math.min(
        emotionSamples.length - 1,
        Math.max(0, Math.floor(t * emotionSamples.length))
      );
      playheadIndex = i;
    }
    return {
      pathD: d,
      points: scaled,
      playheadIndex,
      bounds: { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY },
    };
  }, [emotionSamples, sessionStartMs, sessionEndMs, durationMs, playheadTimeMs]);

  const playheadPoint = playheadIndex >= 0 && playheadIndex < points.length ? points[playheadIndex]! : null;
  const tooltipSample =
    hoverIndex != null && emotionSamples[hoverIndex]
      ? emotionSamples[hoverIndex]!
      : null;

  if (emotionSamples.length === 0) {
    return (
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Emotion path</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[340px] flex items-center justify-center">
          <div className="rounded border border-dashed px-4 py-8 text-sm text-muted-foreground">
            No emotion data
          </div>
        </CardContent>
      </Card>
    );
  }

  const w = SVG_SIZE;
  const h = SVG_SIZE;
  const { minX, maxX, minY, maxY } = bounds;
  const dataCx = (minX + maxX) / 2;
  const dataCy = (minY + maxY) / 2;
  const scaleX = (v: number) =>
    PAD + AXIS_LABEL + ((v - minX) / (maxX - minX || 1)) * graphSize;
  const scaleY = (v: number) =>
    PAD + graphSize - ((v - minY) / (maxY - minY || 1)) * graphSize;
  const cx = scaleX(dataCx);
  const cy = scaleY(dataCy);

  const gradientId = "emotion-path-gradient";
  const start = points[0];
  const end = points[points.length - 1];
  const x1 = start?.x ?? PAD + AXIS_LABEL;
  const y1 = start?.y ?? PAD;
  const x2 = end?.x ?? w - PAD;
  const y2 = end?.y ?? h - PAD;

  const quadrantColors = [
    EMOTION_CATEGORY_COLORS.highEnergyPleasant,
    EMOTION_CATEGORY_COLORS.lowEnergyPleasant,
    EMOTION_CATEGORY_COLORS.lowEnergyUnpleasant,
    EMOTION_CATEGORY_COLORS.highEnergyUnpleasant,
  ];

  const showTooltip = hoverIndex !== null && tooltipSample && tooltipPos;
  const tooltipTimestampMs = tooltipSample ? tooltipSample.timestampMs - sessionStartMs : 0;
  const tooltipTimeStr =
    tooltipTimestampMs >= 0
      ? `${Math.floor(tooltipTimestampMs / 60000)}:${String(Math.floor((tooltipTimestampMs % 60000) / 1000)).padStart(2, "0")}`
      : "0:00";
  const tooltipEl = showTooltip ? (
    <div
      className="pointer-events-none fixed z-[100] rounded-lg border bg-background px-3 py-2 text-xs shadow-xl transition-[left,top,opacity] duration-200 ease-out"
      style={{
        left: tooltipPos!.x,
        top: tooltipPos!.y,
        transform: "translate(12px, -50%)",
        maxWidth: 220,
      }}
    >
      <div className="font-medium text-muted-foreground text-[10px] uppercase tracking-wide">{tooltipTimeStr}</div>
      <div className="mt-1 font-medium text-foreground">Top 3 at this time</div>
      <ul className="mt-1 space-y-1">
        {top3Quadrants(tooltipSample!).map(({ q, value }) => (
          <li key={q} className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: QUADRANT_COLOR[q] }}
              aria-hidden
            />
            <span style={{ color: QUADRANT_COLOR[q], fontWeight: 500 }}>
              {QUADRANT_LABELS[q]}
            </span>
            <span className="text-muted-foreground">{(value * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Emotion path</CardTitle>
      </CardHeader>
      <CardContent className="min-h-[340px] flex items-start justify-center">
        <div className="relative" onMouseLeave={() => { setHoverIndex(null); setTooltipPos(null); }}>
          <svg
            width={w}
            height={h}
            className="overflow-visible"
            onMouseLeave={() => {
              setHoverIndex(null);
              setTooltipPos(null);
            }}
          >
            <defs>
              <linearGradient
                id={gradientId}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor={quadrantColors[0]} />
                <stop offset="33%" stopColor={quadrantColors[1]} />
                <stop offset="66%" stopColor={quadrantColors[2]} />
                <stop offset="100%" stopColor={quadrantColors[3]} />
              </linearGradient>
            </defs>
            {/* Axis labels */}
            <text
              x={PAD + AXIS_LABEL / 2}
              y={cy}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
              transform={`rotate(-90, ${PAD + AXIS_LABEL / 2}, ${cy})`}
            >
              Low energy ← → High energy
            </text>
            <text
              x={w / 2}
              y={h - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              Pleasant ← → Unpleasant
            </text>
            {/* Crosshair at data center */}
            <line
              x1={cx}
              y1={PAD}
              x2={cx}
              y2={h - PAD}
              className="stroke-border/50"
              strokeWidth={0.5}
              strokeDasharray="2 2"
            />
            <line
              x1={PAD + AXIS_LABEL}
              y1={cy}
              x2={w - PAD}
              y2={cy}
              className="stroke-border/50"
              strokeWidth={0.5}
              strokeDasharray="2 2"
            />
            {/* Path with gradient stroke */}
            <path
              d={pathD}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={2}
              strokeOpacity={0.95}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {playheadPoint && (
              <circle
                cx={playheadPoint.x}
                cy={playheadPoint.y}
                r={5}
                className="fill-primary stroke-background"
                strokeWidth={2}
              />
            )}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={12}
                fill="transparent"
                onMouseEnter={(e) => {
                  setHoverIndex(i);
                  setTooltipPos({ x: e.clientX, y: e.clientY });
                }}
              />
            ))}
          </svg>
          {typeof document !== "undefined" && showTooltip && tooltipEl != null && createPortal(tooltipEl, document.body)}
        </div>
      </CardContent>
    </Card>
  );
}

export const EmotionQuadrantPathCard = memo(EmotionQuadrantPathCardInner);
