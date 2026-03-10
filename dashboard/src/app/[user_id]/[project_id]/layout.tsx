"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Loader2 } from "lucide-react";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const project_id = params?.project_id as string | undefined;
  const project = useQuery(
    api.projects.getProject,
    project_id ? { projectId: project_id } : "skip",
  );

  useEffect(() => {
    if (project_id && project === null) {
      const user_id = params?.user_id as string | undefined;
      if (user_id) router.replace(`/${user_id}`);
    }
  }, [project_id, project, params?.user_id, router]);

  if (!project_id) return null;

  if (project === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Access denied or project not found.
      </div>
    );
  }

  return <>{children}</>;
}
