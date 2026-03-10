"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MousePointer2 } from "lucide-react";

export type ClickDataStats = {
  topUnderCursorTag: string;
  topUnderCursorTagCount: number;
  topUnderCursorId: string;
  topUnderCursorIdCount: number;
  topInteractiveTag: string;
  topInteractiveTagCount: number;
  topInteractiveId: string;
  topInteractiveIdCount: number;
  intentMismatchCount: number;
  totalSamples: number;
};

export type MissedClickRow = {
  timestampMs: number;
  underCursorTag: string;
  underCursorId: string;
  targetTag: string;
  targetId: string;
};

type ClickDataCardProps = {
  stats?: ClickDataStats | null;
  missedClicks?: MissedClickRow[] | null;
  sessionStartMs?: number;
};

function formatTime(timestampMs: number, sessionStartMs: number): string {
  const sec = Math.floor((timestampMs - sessionStartMs) / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ClickDataCard({
  stats,
  missedClicks = [],
  sessionStartMs = 0,
}: ClickDataCardProps) {
  const hasData = stats && stats.totalSamples > 0;
  const list = missedClicks ?? [];

  return (
    <Card className="col-span-2 border bg-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MousePointer2 className="size-4" />
          Click data
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-muted-foreground">
            Click data for this session will appear here once available.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2">
              {stats.totalSamples} sample{stats.totalSamples !== 1 ? "s" : ""}
              {stats.intentMismatchCount > 0 && (
                <> · {stats.intentMismatchCount} intent mismatch{stats.intentMismatchCount !== 1 ? "es" : ""}</>
              )}
            </p>
            <ScrollArea className="h-[260px] w-full rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-muted-foreground">Time</TableHead>
                  <TableHead className="text-muted-foreground">Under cursor</TableHead>
                  <TableHead className="text-muted-foreground">Targeting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-sm text-muted-foreground">
                      No missed clicks (intent mismatches) in this session.
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((row, i) => (
                    <TableRow key={`${row.timestampMs}-${i}`}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatTime(row.timestampMs, sessionStartMs)}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{row.underCursorTag}</span>
                        {row.underCursorId !== "(no id)" && (
                          <span className="ml-1 text-muted-foreground">
                            #{row.underCursorId}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{row.targetTag}</span>
                        {row.targetId !== "(no id)" && (
                          <span className="ml-1 text-muted-foreground">
                            #{row.targetId}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
