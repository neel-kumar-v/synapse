"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Stats = {
  aiPromptCount: number;
  linesChanged: number;
} | null | undefined;

type AiPromptsAndLinesCardProps = {
  stats: Stats;
};

export function AiPromptsAndLinesCard({ stats }: AiPromptsAndLinesCardProps) {
  const aiPromptCount = stats?.aiPromptCount ?? 0;
  const linesChanged = stats?.linesChanged ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">AI &amp; code</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">AI prompts</span>
          <span className="font-medium">{aiPromptCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Lines changed</span>
          <span className="font-medium">{linesChanged}</span>
        </div>
      </CardContent>
    </Card>
  );
}
