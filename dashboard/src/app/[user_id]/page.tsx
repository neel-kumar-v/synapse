"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { ProjectCard } from "@/components/project/ProjectCard";

export default function UserProjectsPage() {
  const params = useParams();
  const user_id = params?.user_id as string | undefined;
  const projects = useQuery(api.projects.listProjectsForUser);

  if (projects === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }

  const empty = projects.length === 0;

  return (
    <div className="px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Button asChild>
          <Link href={`/${user_id}/create_project`}>
            <Plus className="size-4 mr-2" />
            New project
          </Link>
        </Button>
      </div>

      {empty ? (
        <div className="rounded-lg border border-dashed border-muted-foreground/40 p-12 text-center">
          <p className="text-muted-foreground mb-4">
            You don&apos;t have any projects yet. Create one to get started.
          </p>
          <Button asChild>
            <Link href={`/${user_id}/create_project`}>
              <Plus className="size-4 mr-2" />
              Create your first project
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              userId={user_id ?? ""}
            />
          ))}
        </div>
      )}
    </div>
  );
}
