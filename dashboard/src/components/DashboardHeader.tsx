"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function DashboardHeader() {
  const pathname = usePathname();
  const params = useParams();
  const user_id = params?.user_id as string | undefined;
  const project_id = params?.project_id as string | undefined;
  const sandbox_id = params?.sandbox_id as string | undefined;

  const project = useQuery(
    api.projects.getProject,
    project_id ? { projectId: project_id } : "skip",
  );
  const sandbox = useQuery(
    api.sandboxes.getSandboxForCurrentUser,
    sandbox_id ? { sandboxId: sandbox_id } : "skip",
  );

  if (!user_id) return null;

  const isUserHome = pathname === `/${user_id}` || pathname === `/${user_id}/`;
  const isCreateProject = pathname?.endsWith("/create_project");
  const isUserProfile = pathname?.endsWith("/user");
  const isAnalyticsPage = Boolean(
    project_id && sandbox_id && pathname?.endsWith("/analytics"),
  );
  const isProjectPage =
    project_id && !isCreateProject && !isUserProfile && !isAnalyticsPage;

  const projectsHref = `/${user_id}`;
  const projectHref = project_id ? `/${user_id}/${project_id}` : projectsHref;

  return (
    <header className="flex h-12 sticky top-0 z-40 bg-background/50 backdrop-blur-md supports-backdrop-filter:bg-background/15 shrink-0 items-center gap-2 border-b border-border/40 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-1.5 data-[orientation=vertical]:h-6"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              {isUserHome ? (
                <BreadcrumbPage>Projects</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={projectsHref}>Projects</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {(isProjectPage || isCreateProject || isUserProfile || isAnalyticsPage) && (
              <>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  {isCreateProject && (
                    <BreadcrumbPage>New project</BreadcrumbPage>
                  )}
                  {isUserProfile && (
                    <BreadcrumbPage>Profile</BreadcrumbPage>
                  )}
                  {isProjectPage &&
                    (project === undefined ? (
                      <BreadcrumbPage>…</BreadcrumbPage>
                    ) : project ? (
                      <BreadcrumbPage>{project.name}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbPage>Project</BreadcrumbPage>
                    ))}
                  {isAnalyticsPage && (
                    <>
                      {project === undefined ? (
                        <BreadcrumbPage>…</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link href={projectHref}>
                            {project?.name ?? "Project"}
                          </Link>
                        </BreadcrumbLink>
                      )}
                    </>
                  )}
                </BreadcrumbItem>
                {isAnalyticsPage && (
                  <>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      {sandbox === undefined ? (
                        <BreadcrumbPage>…</BreadcrumbPage>
                      ) : sandbox_id ? (
                        <BreadcrumbLink asChild>
                          <Link href={`/s/${sandbox_id}`}>
                            {sandbox?.name ?? "Sandbox"}
                          </Link>
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{sandbox?.name ?? "Sandbox"}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>Analytics</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
