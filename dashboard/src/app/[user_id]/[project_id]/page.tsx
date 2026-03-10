"use client";

import { useParams } from "next/navigation";
import { SandboxConvexErrorBoundary } from "@/components/sandbox/SandboxConvexErrorBoundary";
import { SandboxDashboard } from "@/components/sandbox/SandboxDashboard";

export default function ProjectSandboxesPage() {
  const params = useParams();
  const user_id = params?.user_id as string | undefined;
  const project_id = params?.project_id as string | undefined;

  return (
    <SandboxConvexErrorBoundary>
      <SandboxDashboard userId={user_id} projectId={project_id ?? undefined} />
    </SandboxConvexErrorBoundary>
  );
}
