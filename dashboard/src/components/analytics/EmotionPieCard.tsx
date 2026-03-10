"use client";

import { useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import {
  EMOTION_CATEGORY_COLORS,
  EMOTION_CATEGORY_LABELS,
  getEmotionsInQuadrant,
  type EmotionCategory,
  type Quadrant,
} from "@/lib/emotion-categories";

const TOP_EMOTIONS_IN_TOOLTIP = 5;

const LEGACY_NAME_TO_QUADRANT: Record<string, Quadrant> = {
  lowEnergyUnpleasant: "unpleasantLowEnergy",
  lowEnergyPleasant: "pleasantLowEnergy",
  highEnergyPleasant: "pleasantHighEnergy",
  highEnergyUnpleasant: "unpleasantHighEnergy",
};

type EmotionSample = {
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
};

type EmotionPieCardProps = {
  emotionSamples: EmotionSample[];
  /** Per-emotion score sums from telemetry (for tooltip breakdown). Optional. */
  emotionScores?: Record<string, number> | null;
};

export function EmotionPieCard({ emotionSamples, emotionScores }: EmotionPieCardProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const pieData = useMemo(() => {
    if (emotionSamples.length === 0) return null;
    const sums = emotionSamples.reduce(
      (acc, s) => ({
        lowEnergyUnpleasant: acc.lowEnergyUnpleasant + s.lowEnergyUnpleasant,
        lowEnergyPleasant: acc.lowEnergyPleasant + s.lowEnergyPleasant,
        highEnergyPleasant: acc.highEnergyPleasant + s.highEnergyPleasant,
        highEnergyUnpleasant: acc.highEnergyUnpleasant + s.highEnergyUnpleasant,
      }),
      { lowEnergyUnpleasant: 0, lowEnergyPleasant: 0, highEnergyPleasant: 0, highEnergyUnpleasant: 0 },
    );
    const total =
      sums.lowEnergyUnpleasant +
      sums.lowEnergyPleasant +
      sums.highEnergyPleasant +
      sums.highEnergyUnpleasant;
    if (total === 0) return null;
    return [
      { name: "lowEnergyUnpleasant", value: sums.lowEnergyUnpleasant, fill: EMOTION_CATEGORY_COLORS.lowEnergyUnpleasant },
      { name: "lowEnergyPleasant", value: sums.lowEnergyPleasant, fill: EMOTION_CATEGORY_COLORS.lowEnergyPleasant },
      { name: "highEnergyPleasant", value: sums.highEnergyPleasant, fill: EMOTION_CATEGORY_COLORS.highEnergyPleasant },
      { name: "highEnergyUnpleasant", value: sums.highEnergyUnpleasant, fill: EMOTION_CATEGORY_COLORS.highEnergyUnpleasant },
    ];
  }, [emotionSamples]);

  return (
    <Card className="overflow-visible col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Emotion split</CardTitle>
      </CardHeader>
      <CardContent>
        {!pieData ? (
          <div className="flex h-[180px] items-center justify-center rounded border border-dashed text-sm text-muted-foreground">
            No emotion data for this session.
          </div>
        ) : (
        <div ref={chartRef} className="h-[180px] w-full overflow-visible">
        <ChartContainer config={chartConfig} className="h-[180px] w-full overflow-visible">
          <PieChart>
            <Tooltip
              content={({ active, payload, coordinate }) => {
                if (!active || !payload?.length) return null;
                const entry = payload[0]?.payload as { name: string; value: number };
                const categoryLabel = entry?.name
                  ? (chartConfig[entry.name as EmotionCategory]?.label ?? entry.name)
                  : "";
                const quadrant = entry?.name ? LEGACY_NAME_TO_QUADRANT[entry.name] : undefined;
                const quadrantTotal = entry?.value ?? 0;
                const emotionsInQuadrant = quadrant ? getEmotionsInQuadrant(quadrant) : [];
                const withScores =
                  emotionScores && quadrantTotal > 0
                    ? emotionsInQuadrant
                        .map((name) => ({
                          name,
                          score: emotionScores[name] ?? 0,
                        }))
                        .filter((x) => x.score > 0)
                        .sort((a, b) => b.score - a.score)
                        .slice(0, TOP_EMOTIONS_IN_TOOLTIP)
                    : [];
                const quadrantScoreTotal = emotionsInQuadrant.reduce(
                  (s, name) => s + (emotionScores?.[name] ?? 0),
                  0
                );
                const body = (
                  <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl z-[100] transition-[opacity,transform] duration-200 ease-out">
                    <div className="font-medium text-foreground">{categoryLabel}</div>
                    {withScores.length > 0 ? (
                      <div className="mt-1.5 text-muted-foreground">
                        <div className="mb-0.5">Top emotions in this category:</div>
                        <ul className="space-y-0.5">
                          {withScores.map(({ name, score }) => {
                            const pct =
                              quadrantScoreTotal > 0
                                ? ((score / quadrantScoreTotal) * 100).toFixed(1)
                                : "0";
                            return (
                              <li key={name}>
                                {name}: {pct}%
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : emotionsInQuadrant.length > 0 ? (
                      <div className="mt-1.5 text-muted-foreground">
                        <div className="mb-0.5">Emotions in this category:</div>
                        <ul className="list-inside list-disc space-y-0.5">
                          {emotionsInQuadrant.slice(0, TOP_EMOTIONS_IN_TOOLTIP).map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                          {emotionsInQuadrant.length > TOP_EMOTIONS_IN_TOOLTIP && (
                            <li>+{emotionsInQuadrant.length - TOP_EMOTIONS_IN_TOOLTIP} more</li>
                          )}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                );
                const rect = chartRef.current?.getBoundingClientRect();
                const x = coordinate?.x ?? 0;
                const y = coordinate?.y ?? 0;
                const left = rect ? rect.left + x : x;
                const top = rect ? rect.top + y : y;
                if (typeof document !== "undefined") {
                  return createPortal(
                    <div
                      className="pointer-events-none transition-[left,top,opacity] duration-200 ease-out"
                      style={{
                        position: "fixed",
                        left: Math.min(left, window.innerWidth - 240),
                        top: Math.max(8, top - 8),
                        transform: "translateY(-100%)",
                      }}
                    >
                      {body}
                    </div>,
                    document.body
                  );
                }
                return body;
              }}
            />
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={2}
              label={({ name }) => chartConfig[name]?.label ?? name}
            >
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
