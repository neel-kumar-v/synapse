"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import {
  MoreVertical,
  Share2,
  Info,
  Pencil,
  GitBranch,
  EyeOff,
  Trash2,
  Folder,
  Github,
} from "lucide-react";
import { SiVite, SiReact, SiNextdotjs } from "react-icons/si";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShareProjectDialog } from "./ShareProjectDialog";

const TECH_ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  vite: { icon: SiVite, label: "Vite" },
  react: { icon: SiReact, label: "React" },
  nextjs: { icon: SiNextdotjs, label: "Next.js" },
};

function getTechDisplay(projectType: string | undefined) {
  if (!projectType) return null;
  const key = projectType.toLowerCase();
  const entry = TECH_ICONS[key];
  if (entry) {
    const Icon = entry.icon;
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
        <Icon className="size-3.5 shrink-0" />
        {entry.label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
      <Folder className="size-3.5 shrink-0" />
      {projectType}
    </span>
  );
}

export type ProjectEntry = Pick<
  Doc<"projects">,
  "id" | "name" | "githubRepo" | "projectType" | "createdAt"
>;

type ProjectCardProps = {
  project: ProjectEntry;
  userId: string;
};

export function ProjectCard({ project, userId }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const [repoValue, setRepoValue] = useState(project.githubRepo ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateProject = useMutation(api.projects.updateProject);
  const removeProject = useMutation(api.projects.removeProject);

  const openShare = () => {
    setShareOpen(true);
    setMenuOpen(false);
  };
  const openInfo = () => {
    setInfoOpen(true);
    setMenuOpen(false);
  };
  const openRename = () => {
    setRenameValue(project.name);
    setRenameOpen(true);
    setMenuOpen(false);
  };
  const openChangeRepo = () => {
    setRepoValue(project.githubRepo ?? "");
    setRepoOpen(true);
    setMenuOpen(false);
  };
  const openDelete = () => {
    setDeleteOpen(true);
    setMenuOpen(false);
  };

  async function handleHide() {
    try {
      await updateProject({ projectId: project.id, hidden: true });
      setMenuOpen(false);
    } catch (err) {
      console.error("Hide project failed:", err);
    }
  }

  async function handleRenameSubmit() {
    if (renameValue.trim() === project.name) {
      setRenameOpen(false);
      return;
    }
    setIsSubmitting(true);
    try {
      await updateProject({ projectId: project.id, name: renameValue.trim() || project.name });
      setRenameOpen(false);
    } catch (err) {
      console.error("Rename failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRepoSubmit() {
    const trimmed = repoValue.trim().replace(/\.git$/, "");
    const match =
      trimmed.match(/github\.com\/([^/]+)\/([^/]+)/) ??
      trimmed.match(/^([^/]+)\/([^/]+)$/);
    const newRepo = trimmed === "" ? null : (match ? `${match[1]}/${match[2]}` : trimmed);
    if (newRepo === (project.githubRepo ?? null)) {
      setRepoOpen(false);
      return;
    }
    setIsSubmitting(true);
    try {
      await updateProject({
        projectId: project.id,
        githubRepo: newRepo,
      });
      setRepoOpen(false);
    } catch (err) {
      console.error("Change repo failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    setIsSubmitting(true);
    try {
      await removeProject({ projectId: project.id });
      setDeleteOpen(false);
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  const infoRows: { label: string; value: string }[] = [
    { label: "Name", value: project.name },
    { label: "ID", value: project.id },
    {
      label: "Created",
      value: new Date(project.createdAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    },
    { label: "GitHub repo", value: project.githubRepo ?? "—" },
    { label: "Type", value: project.projectType ?? "—" },
  ];

  const projectHref = `/${userId}/${project.id}`;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link
          href={projectHref}
          className="group relative rounded-lg border bg-card p-4 hover:border-primary/50 hover:shadow transition-colors flex flex-col min-h-[88px]"
        >
          {/* Top row: title (left), three dots (right) */}
          <div className="flex items-start justify-between gap-3 min-w-0">
            <h2 className="flex-1 min-w-0 font-semibold truncate pr-9">
              {project.name}
            </h2>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground shrink-0 absolute top-3 right-3"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  aria-label="Project options"
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openShare(); }}>
                  <Share2 className="size-4" />
                  Share project
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openInfo(); }}>
                  <Info className="size-4" />
                  Project info
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openRename(); }}>
                  <Pencil className="size-4" />
                  Rename project
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openChangeRepo(); }}>
                  <GitBranch className="size-4" />
                  Change project GitHub repo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => { e.preventDefault(); handleHide(); }}
                >
                  <EyeOff className="size-4" />
                  Hide project
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(e) => { e.preventDefault(); openDelete(); }}
                >
                  <Trash2 className="size-4" />
                  Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* Bottom row: git icon + repo (left), tech (right), same baseline */}
          <div className="flex items-center justify-between gap-3 min-w-0 mt-2">
            <span className="flex-1 min-w-0 flex items-center gap-1.5 text-sm text-muted-foreground truncate">
              {project.githubRepo ? (
                <>
                  <Github className="size-3.5 shrink-0" />
                  <span className="truncate">{project.githubRepo}</span>
                </>
              ) : (
                <span className="min-h-[0.875rem]" aria-hidden />
              )}
            </span>
            <div className="shrink-0 self-end">
              {getTechDisplay(project.projectType)}
            </div>
          </div>
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48" onClick={(e) => e.stopPropagation()}>
        <ContextMenuItem onSelect={openShare}>
          <Share2 className="size-4" />
          Share project
        </ContextMenuItem>
        <ContextMenuItem onSelect={openInfo}>
          <Info className="size-4" />
          Project info
        </ContextMenuItem>
        <ContextMenuItem onSelect={openRename}>
          <Pencil className="size-4" />
          Rename project
        </ContextMenuItem>
        <ContextMenuItem onSelect={openChangeRepo}>
          <GitBranch className="size-4" />
          Change project GitHub repo
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          className="text-destructive focus:text-destructive"
          onSelect={handleHide}
        >
          <EyeOff className="size-4" />
          Hide project
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onSelect={openDelete}>
          <Trash2 className="size-4" />
          Delete project
        </ContextMenuItem>
      </ContextMenuContent>

      {shareOpen && (
        <ShareProjectDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          projectId={project.id}
          projectName={project.name}
        />
      )}

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Project info</DialogTitle>
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

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Project name"
            onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={repoOpen} onOpenChange={setRepoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change GitHub repo</DialogTitle>
          </DialogHeader>
          <Input
            value={repoValue}
            onChange={(e) => setRepoValue(e.target.value)}
            placeholder="https://github.com/owner/repo or owner/repo"
            onKeyDown={(e) => e.key === "Enter" && handleRepoSubmit()}
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setRepoOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRepoSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{project.name}&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ContextMenu>
  );
}
