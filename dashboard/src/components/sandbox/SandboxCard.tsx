"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";
import {
  Clock,
  GitPullRequest,
  Loader2,
  ExternalLink,
  MoreVertical,
  Pencil,
  EyeOff,
  Trash2,
  Info,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { timeAgo } from "@/lib/sandbox-utils";

export type SandboxEntry = {
  id: string;
  name: string;
  createdAt: number;
  lastOpenedAt: number;
  prUrl?: string;
  prNumber?: number;
  githubRepo?: string;
};

type SandboxCardProps = {
  sandbox: SandboxEntry;
  analyticsHref?: string;
  onOpen: (sandbox: SandboxEntry) => void;
  onRemove: (e: React.MouseEvent, id: string) => void;
  onRename?: (sandbox: SandboxEntry) => void;
  onHide?: (e: React.MouseEvent, id: string) => void;
  onDelete?: (e: React.MouseEvent, id: string) => void;
};

export type SandboxMenuItem =
  | {
      type: "item";
      id: string;
      icon: React.ComponentType<{ className?: string }>;
      label: string;
      onSelect: () => void;
      disabled?: boolean;
      loading?: boolean;
      destructive?: boolean;
      closeOnSelect?: boolean;
    }
  | { type: "separator" };

export function buildSandboxMenuItems({
  sandbox,
  onOpenAnalytics,
  onRename,
  handleHide,
  handleDelete,
  onShowInfo,
  onClose,
  handleCreatePR,
  prLoading,
  prResult,
}: {
  sandbox: SandboxEntry;
  onOpenAnalytics?: () => void;
  onRename?: (sandbox: SandboxEntry) => void;
  handleHide: (e: React.MouseEvent, id: string) => void;
  handleDelete: (e: React.MouseEvent, id: string) => void;
  onShowInfo: () => void;
  onClose?: () => void;
  handleCreatePR: (e: React.MouseEvent) => void;
  prLoading: boolean;
  prResult: string | null;
}): SandboxMenuItem[] {
  const openInNewTab = () => {
    if (typeof window !== "undefined") {
      window.open(`${window.location.origin}/s/${sandbox.id}`, "_blank");
    }
    onClose?.();
  };
  const noop = { stopPropagation: () => {} } as React.MouseEvent;

  const items: SandboxMenuItem[] = [
    {
      type: "item",
      id: "info",
      icon: Info,
      label: "Sandbox info",
      onSelect: () => {
        onShowInfo();
        onClose?.();
      },
      closeOnSelect: true,
    },
    {
      type: "item",
      id: "open",
      icon: ExternalLink,
      label: "Open sandbox",
      onSelect: openInNewTab,
      closeOnSelect: true,
    },
    ...(onOpenAnalytics
      ? [
          {
            type: "item" as const,
            id: "analytics",
            icon: BarChart3,
            label: "Analytics",
            onSelect: () => {
              onOpenAnalytics();
              onClose?.();
            },
            closeOnSelect: true,
          },
        ]
      : []),
    {
      type: "item",
      id: "rename",
      icon: Pencil,
      label: "Rename sandbox",
      onSelect: () => {
        onRename?.(sandbox);
        onClose?.();
      },
      closeOnSelect: true,
    },
    {
      type: "item",
      id: "createPr",
      icon: GitPullRequest,
      label: prResult ? "Update Pull Request" : "Create Pull Request",
      onSelect: () => handleCreatePR(noop),
      disabled: prLoading,
      loading: prLoading,
    },
    { type: "separator" },
    {
      type: "item",
      id: "hide",
      icon: EyeOff,
      label: "Hide sandbox",
      onSelect: () => {
        handleHide(noop, sandbox.id);
        onClose?.();
      },
      destructive: true,
      closeOnSelect: true,
    },
    {
      type: "item",
      id: "delete",
      icon: Trash2,
      label: "Delete sandbox",
      onSelect: () => {
        handleDelete(noop, sandbox.id);
        onClose?.();
      },
      destructive: true,
      closeOnSelect: true,
    },
  ];
  return items;
}

export function SandboxCard({
  sandbox,
  analyticsHref,
  onOpen,
  onRemove,
  onRename,
  onHide,
  onDelete,
}: SandboxCardProps) {
  const router = useRouter();
  const createPR = useAction(api.sandboxes.createPullRequest);
  const [prLoading, setPrLoading] = useState(false);
  const [prResult, setPrResult] = useState<string | null>(
    sandbox.prUrl ?? null,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const handleHide = onHide ?? onRemove;
  const handleDelete = onDelete ?? onRemove;

  async function handleCreatePR(e: React.MouseEvent) {
    e.stopPropagation();
    setPrLoading(true);
    try {
      const result = await createPR({ sandboxId: sandbox.id });
      setPrResult(result.prUrl);
    } catch (err) {
      console.error("Create PR failed:", err);
    } finally {
      setPrLoading(false);
    }
  }

  const menuItems = buildSandboxMenuItems({
    sandbox,
    onOpenAnalytics: analyticsHref ? () => router.push(analyticsHref) : undefined,
    onRename,
    handleHide,
    handleDelete,
    onShowInfo: () => setInfoOpen(true),
    onClose: () => setMenuOpen(false),
    handleCreatePR,
    prLoading,
    prResult,
  });

  const infoRows: { label: string; value: string }[] = [
    { label: "Name", value: sandbox.name },
    { label: "ID", value: sandbox.id },
    {
      label: "Created",
      value: new Date(sandbox.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    },
    { label: "Last opened", value: timeAgo(sandbox.lastOpenedAt) },
    { label: "PR number", value: sandbox.prNumber != null ? `#${sandbox.prNumber}` : "—" },
    { label: "PR URL", value: sandbox.prUrl ?? "—" },
    { label: "GitHub repo", value: sandbox.githubRepo ?? "—" },
  ];

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card
          role="button"
          tabIndex={0}
          onClick={() => onOpen(sandbox)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen(sandbox);
            }
          }}
          className="group relative cursor-pointer overflow-hidden transition-all bg-card border rounded-lg hover:border-primary/50 hover:shadow transition-colors flex flex-col min-h-[88px] p-4"
        >
          {/* Top row: title (left), actions (right) */}
          <div className="flex items-start justify-between gap-3 min-w-0">
            <h2 className="flex-1 min-w-0 font-semibold truncate pr-9">
              {sandbox.name}
            </h2>
            <div className="flex items-center justify-end gap-1 shrink-0 absolute top-3 right-3">
              {analyticsHref && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 text-muted-foreground hover:text-foreground hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(analyticsHref);
                      }}
                      aria-label="Open Analytics"
                    >
                      <BarChart3 className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Analytics</TooltipContent>
                </Tooltip>
              )}
              {prResult ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={prResult}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-primary/10"
                      aria-label="Open Pull Request"
                    >
                      <ExternalLink className="size-5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>PR #{sandbox.prNumber ?? ""}</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 text-muted-foreground hover:text-foreground hover:bg-primary/10"
                      onClick={handleCreatePR}
                      disabled={prLoading}
                      aria-label="Create Pull Request"
                    >
                      {prLoading ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        <GitPullRequest className="size-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Create Pull Request</TooltipContent>
                </Tooltip>
              )}
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-muted-foreground hover:text-foreground hover:bg-accent"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Sandbox options"
                  >
                    <MoreVertical className="size-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {menuItems.map((item) =>
                    item.type === "separator" ? (
                      <DropdownMenuSeparator key="sep" />
                    ) : (
                      <DropdownMenuItem
                        key={item.id}
                        variant={item.destructive ? "destructive" : undefined}
                        className={item.destructive ? "text-destructive focus:text-destructive" : undefined}
                        onSelect={(e) => {
                          e.preventDefault();
                          item.onSelect();
                        }}
                        disabled={item.disabled}
                      >
                        {item.loading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <item.icon className="size-4" />
                        )}
                        {item.label}
                      </DropdownMenuItem>
                    )
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {/* Bottom row: last opened */}
          <div className="flex items-center justify-between gap-3 min-w-0 mt-2">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-3.5 shrink-0" />
              <span>{timeAgo(sandbox.lastOpenedAt)}</span>
            </div>
          </div>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48" onClick={(e) => e.stopPropagation()}>
        {menuItems.map((item) =>
          item.type === "separator" ? (
            <ContextMenuSeparator key="sep" />
          ) : (
            <ContextMenuItem
              key={item.id}
              variant={item.destructive ? "destructive" : undefined}
              className={item.destructive ? "text-destructive focus:text-destructive" : undefined}
              onSelect={item.onSelect}
              disabled={item.disabled}
            >
              {item.loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <item.icon className="size-4" />
              )}
              {item.label}
            </ContextMenuItem>
          )
        )}
      </ContextMenuContent>
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sandbox info</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-left">
            {infoRows.map(({ label, value }) => (
              <div
                key={label}
                className="flex justify-between items-baseline gap-6"
              >
                <span className="text-muted-foreground shrink-0">{label}</span>
                <span className="text-foreground text-right break-all min-w-0">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </ContextMenu>
  );
}
