"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SupermemorySummaryCardProps = {
  summary?: string | null;
};

export function SupermemorySummaryCard({ summary }: SupermemorySummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Supermemory summary</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {summary ?? "No summary available for this session."}
        </p>
      </CardContent>
    </Card>
  );
}
