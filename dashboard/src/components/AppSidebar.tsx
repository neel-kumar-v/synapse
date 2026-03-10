"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "convex/_generated/api";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { authClient } from "@/lib/auth-client";
import {
  BarChart,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Sun,
  MoreVertical,
  Share2,
  Info,
  Pencil,
  GitBranch,
  EyeOff,
  Trash2,
  ExternalLink,
  BarChart3,
  Loader2,
  GitPullRequest,
} from "lucide-react";
import { ShareProjectDialog } from "@/components/project/ShareProjectDialog";
import {
  buildSandboxMenuItems,
  type SandboxEntry,
} from "@/components/sandbox/SandboxCard";
import { timeAgo } from "@/lib/sandbox-utils";

const SYNAPSE_PATH =
  "M547.596558,142.588333 C542.816101,139.088135 539.528931,139.961685 535.398499,143.902679 C505.876587,172.070709 476.074402,199.945389 446.289398,227.836517 C444.050140,229.933395 443.162445,231.739395 444.580048,234.712097 C446.379822,238.486252 447.470978,242.569702 447.381409,246.787018 C447.284851,251.333038 449.774353,253.056747 453.778961,254.184998 C475.076447,260.185303 496.323700,266.364075 517.579224,272.512756 C534.844971,277.507294 552.096130,282.552094 569.357666,287.561188 C572.865112,288.579010 576.396179,289.515411 579.904907,290.528839 C582.688416,291.332825 584.471069,290.344757 586.253418,288.033112 C596.874939,274.257477 611.171875,268.451172 628.074707,271.496674 C645.434631,274.624512 657.406616,285.071381 661.381836,302.663666 C668.686157,334.988403 640.941711,358.035522 614.534607,353.845215 C609.369324,353.025635 604.396057,351.698120 599.961487,348.983429 C597.266907,347.333862 595.512878,347.936920 593.443665,349.915710 C581.047546,361.770233 568.575928,373.545746 556.130005,385.348114 C539.214661,401.388824 522.341492,417.474457 505.343414,433.426910 C502.496368,436.098816 502.034332,438.349579 503.588226,442.116028 C512.899048,464.684357 503.876404,488.278564 482.319061,498.588593 C461.453308,508.567932 436.273773,500.682495 425.179626,480.694427 C411.165680,455.445770 425.187012,423.389160 453.407745,417.309357 C463.574585,415.119019 474.072540,415.777100 483.576233,420.978851 C486.529480,422.595306 488.298889,421.941284 490.503204,419.837036 C520.385620,391.310974 550.320679,362.839966 580.281921,334.396606 C582.037781,332.729706 582.918335,331.276550 581.724426,328.794525 C579.760803,324.712402 578.901001,320.260529 578.409119,315.782196 C578.079041,312.777161 576.805969,311.078918 573.744873,310.201202 C544.790894,301.899567 515.870056,293.481842 486.946838,285.073181 C473.998047,281.308716 461.027130,277.612518 448.146637,273.625519 C443.787689,272.276276 441.057037,272.883545 438.116211,276.820618 C427.647308,290.835999 407.797363,296.021942 390.859253,289.721069 C372.826843,283.013184 362.750885,267.158630 363.721497,247.019745 C364.507416,230.712982 377.290619,215.621902 393.604614,210.750610 C404.875946,207.385056 415.387421,209.057114 425.539429,214.046921 C428.748749,215.624329 430.473511,215.032227 432.863251,212.773544 C463.129150,184.167282 493.473511,155.643829 523.864624,127.170517 C526.098022,125.078041 526.785767,123.355469 525.546143,120.287560 C513.365479,90.142624 532.448364,59.503624 564.780640,57.077938 C587.330994,55.386127 607.979675,72.538727 611.769287,96.110840 C615.240356,117.701546 600.003235,140.221039 578.666016,145.493652 C568.014343,148.125748 557.881775,146.996094 547.596558,142.588333z";

function SynapseLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1024 544"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path fill="currentColor" d={SYNAPSE_PATH} />
    </svg>
  );
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email?.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return "?";
}

type AppSidebarProps = { userId: string };

export function AppSidebar({ userId }: AppSidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const projectSegment = pathname?.split("/")[2];
  const isProjectPage =
    pathname?.startsWith(`/${userId}/`) &&
    projectSegment &&
    projectSegment !== "create_project" &&
    projectSegment !== "user";
  const projectId = isProjectPage ? projectSegment : null;

  const projects = useQuery(api.projects.listProjectsForUser) ?? [];
  const currentProjectName = projectId
    ? projects.find((p) => p.id === projectId)?.name ?? null
    : null;

  const sandboxes = useQuery(
    api.sandboxes.listSandboxes,
    projectId != null ? { projectId } : "skip",
  ) ?? [];

  const updateProject = useMutation(api.projects.updateProject);
  const removeProject = useMutation(api.projects.removeProject);
  const removeSandbox = useMutation(api.sandboxes.removeSandbox);
  const renameSandboxMutation = useMutation(api.sandboxes.renameSandbox);
  const createPR = useAction(api.sandboxes.createPullRequest);

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectShareOpen, setProjectShareOpen] = useState(false);
  const [projectInfoOpen, setProjectInfoOpen] = useState(false);
  const [projectRenameOpen, setProjectRenameOpen] = useState(false);
  const [projectRepoOpen, setProjectRepoOpen] = useState(false);
  const [projectDeleteOpen, setProjectDeleteOpen] = useState(false);
  const [projectRenameValue, setProjectRenameValue] = useState("");
  const [projectRepoValue, setProjectRepoValue] = useState("");
  const [projectSubmitting, setProjectSubmitting] = useState(false);

  const [sandboxRenameFor, setSandboxRenameFor] = useState<SandboxEntry | null>(null);
  const [sandboxRenameValue, setSandboxRenameValue] = useState("");
  const [sandboxInfoFor, setSandboxInfoFor] = useState<SandboxEntry | null>(null);
  const [sandboxPrLoading, setSandboxPrLoading] = useState<Record<string, boolean>>({});
  const [sandboxPrResult, setSandboxPrResult] = useState<Record<string, string | null>>({});

  const activeProject = activeProjectId
    ? projects.find((p) => p.id === activeProjectId) ?? null
    : null;

  const openProjectShare = (id: string) => {
    setActiveProjectId(id);
    setProjectShareOpen(true);
  };
  const openProjectInfo = (id: string) => {
    setActiveProjectId(id);
    setProjectInfoOpen(true);
  };
  const openProjectRename = (id: string) => {
    const p = projects.find((pr) => pr.id === id);
    if (p) {
      setActiveProjectId(id);
      setProjectRenameValue(p.name);
      setProjectRenameOpen(true);
    }
  };
  const openProjectRepo = (id: string) => {
    const p = projects.find((pr) => pr.id === id);
    if (p) {
      setActiveProjectId(id);
      setProjectRepoValue(p.githubRepo ?? "");
      setProjectRepoOpen(true);
    }
  };
  const openProjectDelete = (id: string) => {
    setActiveProjectId(id);
    setProjectDeleteOpen(true);
  };

  async function handleProjectHide(projId: string) {
    try {
      await updateProject({ projectId: projId, hidden: true });
    } catch (err) {
      console.error("Hide project failed:", err);
    }
  }

  async function handleProjectRenameSubmit() {
    if (!activeProjectId) return;
    const p = projects.find((pr) => pr.id === activeProjectId);
    if (!p || projectRenameValue.trim() === p.name) {
      setProjectRenameOpen(false);
      return;
    }
    setProjectSubmitting(true);
    try {
      await updateProject({ projectId: activeProjectId, name: projectRenameValue.trim() || p.name });
      setProjectRenameOpen(false);
    } catch (err) {
      console.error("Rename failed:", err);
    } finally {
      setProjectSubmitting(false);
    }
  }

  async function handleProjectRepoSubmit() {
    if (!activeProjectId) return;
    const p = projects.find((pr) => pr.id === activeProjectId);
    if (!p) return;
    const trimmed = projectRepoValue.trim().replace(/\.git$/, "");
    const match =
      trimmed.match(/github\.com\/([^/]+)\/([^/]+)/) ??
      trimmed.match(/^([^/]+)\/([^/]+)$/);
    const newRepo = trimmed === "" ? null : (match ? `${match[1]}/${match[2]}` : trimmed);
    if (newRepo === (p.githubRepo ?? null)) {
      setProjectRepoOpen(false);
      return;
    }
    setProjectSubmitting(true);
    try {
      await updateProject({ projectId: activeProjectId, githubRepo: newRepo });
      setProjectRepoOpen(false);
    } catch (err) {
      console.error("Change repo failed:", err);
    } finally {
      setProjectSubmitting(false);
    }
  }

  async function handleProjectDeleteConfirm() {
    if (!activeProjectId) return;
    setProjectSubmitting(true);
    try {
      await removeProject({ projectId: activeProjectId });
      setProjectDeleteOpen(false);
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setProjectSubmitting(false);
    }
  }

  function handleSandboxRemove(_e: React.MouseEvent, id: string) {
    removeSandbox({ id });
  }
  function handleSandboxRename(sandbox: SandboxEntry) {
    setSandboxRenameFor(sandbox);
    setSandboxRenameValue(sandbox.name);
  }
  function submitSandboxRename() {
    if (!sandboxRenameFor) return;
    const name = sandboxRenameValue.trim();
    if (name) {
      renameSandboxMutation({ id: sandboxRenameFor.id, name });
      setSandboxRenameFor(null);
      setSandboxRenameValue("");
    }
  }
  async function handleSandboxCreatePR(sandboxId: string) {
    setSandboxPrLoading((prev) => ({ ...prev, [sandboxId]: true }));
    try {
      const result = await createPR({ sandboxId });
      setSandboxPrResult((prev) => ({ ...prev, [sandboxId]: result.prUrl }));
    } catch (err) {
      console.error("Create PR failed:", err);
    } finally {
      setSandboxPrLoading((prev) => ({ ...prev, [sandboxId]: false }));
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenuButton asChild className="w-full justify-start min-w-0 px-2 py-1">
          <Link href={`/${userId}`} className="flex items-center gap-2 hover:bg-transparent">
            <SynapseLogo className="size-12! text-sidebar-foreground shrink-0 -translate-x-4" />
            <span className="text-xl font-semibold -translate-x-8">Synapse</span>
          </Link>
        </SidebarMenuButton>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <div className="relative h-8">
                  <SidebarMenuButton asChild isActive={pathname === `/${userId}`} tooltip="Projects">
                    <Link href={`/${userId}`}>
                      <FolderKanban className="size-4" />
                      <span>Projects</span>
                    </Link>
                  </SidebarMenuButton>
                  <SidebarMenuAction asChild className="top-0! right-0! bottom-0! h-full! w-8! aspect-auto! rounded-r-md">
                    <Link href={`/${userId}/create_project`} aria-label="New project" className="h-full w-full flex items-center justify-center">
                      <Plus className="size-4" />
                    </Link>
                  </SidebarMenuAction>
                </div>
                <SidebarMenuSub>
                  {projects.map((project) => (
                    <SidebarMenuSubItem key={project.id}>
                      <div className="relative group/subb">
                        <SidebarMenuSubButton asChild isActive={pathname === `/${userId}/${project.id}`} className="pr-8">
                          <Link href={`/${userId}/${project.id}`}>
                            <span className="truncate">{project.name}</span>
                          </Link>
                        </SidebarMenuSubButton>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-0 right-0 h-7 w-6 rounded-md text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden"
                              onClick={(e) => e.preventDefault()}
                              aria-label="Project options"
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openProjectShare(project.id); }}>
                              <Share2 className="size-4" />
                              Share project
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openProjectInfo(project.id); }}>
                              <Info className="size-4" />
                              Project info
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openProjectRename(project.id); }}>
                              <Pencil className="size-4" />
                              Rename project
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openProjectRepo(project.id); }}>
                              <GitBranch className="size-4" />
                              Change project GitHub repo
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              className="text-destructive focus:text-destructive"
                              onSelect={(e) => { e.preventDefault(); handleProjectHide(project.id); }}
                            >
                              <EyeOff className="size-4" />
                              Hide project
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={(e) => { e.preventDefault(); openProjectDelete(project.id); }}
                            >
                              <Trash2 className="size-4" />
                              Delete project
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </SidebarMenuItem>
              {/* <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/ux_telemetry">
                    <BarChart className="size-4" />
                    <span>UX Telemetry</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem> */}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {projectId && (
          <SidebarGroup>
            <SidebarGroupLabel>{currentProjectName ?? "Project"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === `/${userId}/${projectId}`}>
                    <Link href={`/${userId}/${projectId}`}>
                      <LayoutDashboard className="size-4" />
                      <span>Sandboxes</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuSub>
                  {sandboxes.map((sb) => {
                    const sandboxEntry: SandboxEntry = {
                      id: sb.id,
                      name: sb.name,
                      createdAt: sb.createdAt,
                      lastOpenedAt: sb.lastOpenedAt,
                      prUrl: sb.prUrl ?? undefined,
                      prNumber: sb.prNumber ?? undefined,
                      githubRepo: sb.githubRepo ?? undefined,
                    };
                    const analyticsHref = `/${userId}/${projectId}/${sb.id}/analytics`;
                    const menuItems = buildSandboxMenuItems({
                      sandbox: sandboxEntry,
                      onOpenAnalytics: () => router.push(analyticsHref),
                      onRename: handleSandboxRename,
                      handleHide: handleSandboxRemove,
                      handleDelete: handleSandboxRemove,
                      onShowInfo: () => setSandboxInfoFor(sandboxEntry),
                      onClose: undefined,
                      handleCreatePR: () => handleSandboxCreatePR(sb.id),
                      prLoading: sandboxPrLoading[sb.id] ?? false,
                      prResult: sandboxPrResult[sb.id] ?? sb.prUrl ?? null,
                    });
                    return (
                      <SidebarMenuSubItem key={sb.id}>
                        <div className="relative group/subb">
                          <SidebarMenuSubButton
                            asChild
                            isActive={pathname?.includes(`/${sb.id}/`) ?? false}
                            className="pr-8"
                          >
                            <Link href={`/s/${sb.id}`}>
                              <span className="truncate">{sb.name}</span>
                            </Link>
                          </SidebarMenuSubButton>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-0 right-0 h-7 w-6 rounded-md text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden"
                                onClick={(e) => e.preventDefault()}
                                aria-label="Sandbox options"
                              >
                                <MoreVertical className="size-4" />
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
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
              <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href={`/${userId}/user`} className="flex items-center gap-2">
                <Avatar className="size-6 shrink-0">
                  <AvatarFallback className="text-xs">
                    {getInitials(user?.name, user?.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">Profile</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
            >
              <Button 
                variant="ghost" 
                size="icon" 
                className="flex items-start justify-start text-left w-full gap-2 text-foreground hover:bg-foreground/10"
                aria-label="Sign out"
                onClick={async () => {
                  await authClient.signOut();
                  router.push("/");
                }}
              >
                <LogOut className="size-4" />
                <span>Sign out</span>
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {activeProject && (
        <>
          {projectShareOpen && (
            <ShareProjectDialog
              open={projectShareOpen}
              onOpenChange={setProjectShareOpen}
              projectId={activeProject.id}
              projectName={activeProject.name}
            />
          )}
          <Dialog open={projectInfoOpen} onOpenChange={setProjectInfoOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Project info</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 text-left">
                {[
                  { label: "Name", value: activeProject.name },
                  { label: "ID", value: activeProject.id },
                  {
                    label: "Created",
                    value: new Date(activeProject.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  },
                  { label: "GitHub repo", value: activeProject.githubRepo ?? "—" },
                  { label: "Type", value: activeProject.projectType ?? "—" },
                ].map(({ label, value }) => (
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
          <Dialog open={projectRenameOpen} onOpenChange={setProjectRenameOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Rename project</DialogTitle>
              </DialogHeader>
              <Input
                value={projectRenameValue}
                onChange={(e) => setProjectRenameValue(e.target.value)}
                placeholder="Project name"
                onKeyDown={(e) => e.key === "Enter" && handleProjectRenameSubmit()}
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" onClick={() => setProjectRenameOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleProjectRenameSubmit} disabled={projectSubmitting}>
                  {projectSubmitting ? "Saving…" : "Save"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={projectRepoOpen} onOpenChange={setProjectRepoOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Change GitHub repo</DialogTitle>
              </DialogHeader>
              <Input
                value={projectRepoValue}
                onChange={(e) => setProjectRepoValue(e.target.value)}
                placeholder="https://github.com/owner/repo or owner/repo"
                onKeyDown={(e) => e.key === "Enter" && handleProjectRepoSubmit()}
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" onClick={() => setProjectRepoOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleProjectRepoSubmit} disabled={projectSubmitting}>
                  {projectSubmitting ? "Saving…" : "Save"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <AlertDialog open={projectDeleteOpen} onOpenChange={setProjectDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete project?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &quot;{activeProject.name}&quot;. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleProjectDeleteConfirm();
                  }}
                  disabled={projectSubmitting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {projectSubmitting ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {sandboxInfoFor && (
        <Dialog open={!!sandboxInfoFor} onOpenChange={(open) => !open && setSandboxInfoFor(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Sandbox info</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 text-left">
              {[
                { label: "Name", value: sandboxInfoFor.name },
                { label: "ID", value: sandboxInfoFor.id },
                {
                  label: "Created",
                  value: new Date(sandboxInfoFor.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                },
                { label: "Last opened", value: timeAgo(sandboxInfoFor.lastOpenedAt) },
                { label: "PR number", value: sandboxInfoFor.prNumber != null ? `#${sandboxInfoFor.prNumber}` : "—" },
                { label: "PR URL", value: sandboxInfoFor.prUrl ?? "—" },
                { label: "GitHub repo", value: sandboxInfoFor.githubRepo ?? "—" },
              ].map(({ label, value }) => (
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
      )}

      <Dialog open={!!sandboxRenameFor} onOpenChange={(open) => !open && setSandboxRenameFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename sandbox</DialogTitle>
          </DialogHeader>
          <Input
            value={sandboxRenameValue}
            onChange={(e) => setSandboxRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitSandboxRename()}
            placeholder="Sandbox name"
            aria-label="Sandbox name"
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setSandboxRenameFor(null)}>
              Cancel
            </Button>
            <Button onClick={submitSandboxRename} disabled={!sandboxRenameValue.trim()}>
              Rename
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
