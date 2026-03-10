"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, GitPullRequest, Loader2 } from "lucide-react";

type Sandbox = {
  id: string;
  prUrl?: string | null;
  prNumber?: number | null;
};

type PrStatusCardProps = {
  sandbox: Sandbox;
};

export function PrStatusCard({ sandbox }: PrStatusCardProps) {
  const createPullRequest = useAction(api.sandboxes.createPullRequest);
  const [loading, setLoading] = useState(false);
  const [prUrl, setPrUrl] = useState<string | null>(sandbox.prUrl ?? null);

  async function handleCreateOrUpdatePr() {
    setLoading(true);
    try {
      const result = await createPullRequest({ sandboxId: sandbox.id });
      setPrUrl(result.prUrl);
    } catch (err) {
      console.error("Create/update PR failed:", err);
    } finally {
      setLoading(false);
    }
  }

  const displayUrl = prUrl ?? sandbox.prUrl;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pull request</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayUrl ? (
          <>
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-4" />
              {sandbox.prNumber != null ? `PR #${sandbox.prNumber}` : "Open PR"}
            </a>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleCreateOrUpdatePr}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>Update PR</>
              )}
            </Button>
          </>
        ) : (
          <Button
            className="w-full"
            onClick={handleCreateOrUpdatePr}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <GitPullRequest className="size-4 mr-2" />
                Create PR
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
