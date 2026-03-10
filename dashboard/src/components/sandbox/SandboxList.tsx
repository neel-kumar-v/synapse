"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GitMerge, Loader2, ExternalLink, Plus } from "lucide-react";
import type { SandboxEntry } from "./SandboxCard";
import { SandboxCard } from "./SandboxCard";
import { SandboxEmptyState } from "./SandboxEmptyState";

type SandboxListProps = {
  userId?: string;
  projectId?: string;
  onOpenSandbox: (sandbox: SandboxEntry) => void;
  onInviteMoreTesters?: () => void;
};

export function SandboxList({
  userId,
  projectId,
  onOpenSandbox,
  onInviteMoreTesters,
}: SandboxListProps) {
  const sandboxes = useQuery(
    api.sandboxes.listSandboxes,
    projectId != null ? { projectId } : {},
  );
  const project = useQuery(
    api.projects.getProject,
    projectId != null ? { projectId } : "skip",
  );
  const updateLastOpened = useMutation(api.sandboxes.updateLastOpened);
  const removeSandbox = useMutation(api.sandboxes.removeSandbox);
  const renameSandboxMutation = useMutation(api.sandboxes.renameSandbox);
  const aggregatePRs = useAction(api.sandboxes.aggregatePullRequests);

  const [renameFor, setRenameFor] = useState<SandboxEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Aggregate PRs dialog state
  const [mergeOpen, setMergeOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<{ prUrl: string; prNumber: number; included: string[]; skipped: string[] } | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);

  function openMergeDialog() {
    setSelectedIds(new Set(sandboxes?.map((s) => s.id) ?? []));
    setMergeResult(null);
    setMergeError(null);
    setMergeOpen(true);
  }

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleMerge() {
    if (!projectId || selectedIds.size === 0) return;
    setMerging(true);
    setMergeError(null);
    setMergeResult(null);
    try {
      const result = await aggregatePRs({ projectId, sandboxIds: Array.from(selectedIds) });
      setMergeResult(result);
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : "Failed to aggregate PRs");
    } finally {
      setMerging(false);
    }
  }

  function handleOpen(sandbox: SandboxEntry) {
    updateLastOpened({ id: sandbox.id });
    onOpenSandbox(sandbox);
  }

  function handleRemove(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    removeSandbox({ id });
  }

  function handleRename(sandbox: SandboxEntry) {
    setRenameFor(sandbox);
    setRenameValue(sandbox.name);
  }

  function closeRenameDialog() {
    setRenameFor(null);
    setRenameValue("");
  }

  function submitRename() {
    if (!renameFor) return;
    const name = renameValue.trim();
    if (name) {
      renameSandboxMutation({ id: renameFor.id, name });
      closeRenameDialog();
    }
  }

  if (sandboxes === undefined) {
    return (
      <div className="text-muted-foreground text-sm py-8">Loading…</div>
    );
  }

  if (sandboxes.length === 0 && onInviteMoreTesters) {
    return (
      <SandboxEmptyState onInviteTesters={onInviteMoreTesters} />
    );
  }

  if (sandboxes.length === 0) {
    return null;
  }

  const title = project?.name ? `${project.name}'s sandboxes` : "Sandboxes";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {projectId && sandboxes && sandboxes.length > 0 && (
          <Button variant="outline" size="sm" onClick={openMergeDialog} className="gap-2">
            <GitMerge className="size-4" />
            Merge PRs
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sandboxes.map((sb) => (
          <SandboxCard
            key={sb.id}
            sandbox={{
              id: sb.id,
              name: sb.name,
              createdAt: sb.createdAt,
              lastOpenedAt: sb.lastOpenedAt,
              prUrl: sb.prUrl ?? undefined,
              prNumber: sb.prNumber ?? undefined,
              githubRepo: sb.githubRepo ?? undefined,
            }}
            analyticsHref={userId && projectId ? `/${userId}/${projectId}/${sb.id}/analytics` : undefined}
            onOpen={handleOpen}
            onRemove={handleRemove}
            onRename={handleRename}
            onHide={handleRemove}
            onDelete={handleRemove}
          />
        ))}
        {onInviteMoreTesters && (
          <Card
            role="button"
            tabIndex={0}
            className="group border-dashed border-2 cursor-pointer transition-colors hover:border-primary hover:bg-muted/30 flex min-h-[100px]"
            onClick={onInviteMoreTesters}
            onKeyDown={(e) =>
              (e.key === "Enter" || e.key === " ") && onInviteMoreTesters()
            }
          >
            <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary/80 group-hover:text-primary/80 transition-all text-center">
              <Plus className="size-10" />
              <span className="font-medium text-sm">Invite more testers!</span>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Aggregate / Merge PRs dialog ── */}
      <Dialog open={mergeOpen} onOpenChange={(open) => !merging && setMergeOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="size-5" />
              Merge PRs into one
            </DialogTitle>
            <DialogDescription>
              Select the sandboxes whose changes you want to combine into a single pull request. Each sandbox's files will be placed under{" "}
              <code className="text-xs font-mono">sandbox/{"<id>"}/</code> in the branch.
            </DialogDescription>
          </DialogHeader>

          {!mergeResult ? (
            <>
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
                {/* Select all / none */}
                <label className="flex items-center gap-3 px-1 py-1.5 rounded cursor-pointer hover:bg-muted/50 text-sm text-muted-foreground select-none">
                  <Checkbox
                    checked={sandboxes?.every((s) => selectedIds.has(s.id)) ?? false}
                    onCheckedChange={(checked) =>
                      setSelectedIds(checked ? new Set(sandboxes?.map((s) => s.id) ?? []) : new Set())
                    }
                  />
                  <span className="font-medium">Select all</span>
                </label>
                <div className="border-t border-border my-1" />
                {sandboxes?.map((sb) => (
                  <label
                    key={sb.id}
                    className="flex items-center gap-3 px-1 py-1.5 rounded cursor-pointer hover:bg-muted/50 select-none"
                  >
                    <Checkbox
                      checked={selectedIds.has(sb.id)}
                      onCheckedChange={() => toggleId(sb.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{sb.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{sb.id}</p>
                    </div>
                    {sb.prUrl && (
                      <a
                        href={sb.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        title={`PR #${sb.prNumber}`}
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </label>
                ))}
              </div>

              {mergeError && (
                <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
                  {mergeError}
                </p>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setMergeOpen(false)} disabled={merging}>
                  Cancel
                </Button>
                <Button
                  onClick={handleMerge}
                  disabled={merging || selectedIds.size === 0}
                  className="gap-2"
                >
                  {merging ? <Loader2 className="size-4 animate-spin" /> : <GitMerge className="size-4" />}
                  {merging ? "Merging…" : `Merge ${selectedIds.size} sandbox${selectedIds.size === 1 ? "" : "es"}`}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
                  Aggregated PR created successfully with {mergeResult.included.length} sandbox{mergeResult.included.length === 1 ? "" : "es"}.
                </div>
                {mergeResult.skipped.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {mergeResult.skipped.length} sandbox{mergeResult.skipped.length === 1 ? " was" : "es were"} skipped (no files or export failed).
                  </p>
                )}
                <a
                  href={mergeResult.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <ExternalLink className="size-4" />
                  View PR #{mergeResult.prNumber}
                </a>
              </div>
              <DialogFooter>
                <Button onClick={() => setMergeOpen(false)}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameFor} onOpenChange={(open) => !open && closeRenameDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename sandbox</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitRename()}
            placeholder="Sandbox name"
            aria-label="Sandbox name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={closeRenameDialog}>
              Cancel
            </Button>
            <Button onClick={submitRename} disabled={!renameValue.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
