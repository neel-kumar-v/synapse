"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreateSandboxDialog, type TesterRow } from "./CreateSandboxDialog";
import { SandboxEmptyState } from "./SandboxEmptyState";
import { SandboxList } from "./SandboxList";
import type { SandboxEntry } from "./SandboxCard";

type SandboxDashboardProps = { userId?: string; projectId?: string };

export function SandboxDashboard({ userId, projectId }: SandboxDashboardProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const inviteTestersAction = useAction(api.sandboxes.inviteTesters);

  const workerBase = process.env.NEXT_PUBLIC_WORKER_BASE_URL ?? "";
  const hasWorkerUrl = !!workerBase;

  async function handleCreate(testers: TesterRow[]) {
    if (testers.length === 0) return;
    setCreating(true);
    try {
      await inviteTestersAction({ testers, projectId });
      setModalOpen(false);
    } catch (err) {
      console.error("Invite testers failed:", err);
    } finally {
      setCreating(false);
    }
  }

  function handleOpenSandbox(sandbox: SandboxEntry) {
    router.push(`/s/${sandbox.id}`);
  }

  return (
    <>
      <div className="px-6 py-12">
        <SandboxList
          userId={userId}
          projectId={projectId}
          onOpenSandbox={handleOpenSandbox}
          onInviteMoreTesters={() => setModalOpen(true)}
        />

        {!hasWorkerUrl && (
          <Alert variant="destructive" className="mt-8">
            <AlertDescription>
              Set{" "}
              <code className="font-mono text-destructive-foreground">
                NEXT_PUBLIC_WORKER_BASE_URL
              </code>{" "}
              so inviting testers can open sandboxes on your Worker.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <CreateSandboxDialog
        open={modalOpen}
        onOpenChange={(open) => !creating && setModalOpen(open)}
        onCreate={handleCreate}
      />
    </>
  );
}
