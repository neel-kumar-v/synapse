"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserMinus } from "lucide-react";

type ShareProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
};

export function ShareProjectDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: ShareProjectDialogProps) {
  const [emailPrefix, setEmailPrefix] = useState("");
  const members = useQuery(api.projects.listProjectMembers, { projectId });
  const userEmails = useQuery(
    api.userEmails.listUserEmailsByPrefix,
    open ? { prefix: emailPrefix || undefined } : "skip",
  );
  const addMember = useMutation(api.projects.addProjectMember);
  const removeMember = useMutation(api.projects.removeProjectMember);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberSet = new Set(members?.map((m) => m.userId) ?? []);
  const options = (userEmails ?? []).filter((u) => !memberSet.has(u.userId));

  async function handleAdd(userId: string, email: string) {
    setError(null);
    setAdding(true);
    try {
      await addMember({ projectId, userId, email });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(userId: string) {
    setError(null);
    try {
      await removeMember({ projectId, userId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share &quot;{projectName}&quot;</DialogTitle>
          <DialogDescription>
            Add members by email. Only users who have signed in appear in the list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <p className="text-sm font-medium mb-2">Add member</p>
            <Input
              placeholder={'Search by email...'}
              value={emailPrefix}
              onChange={(e) => setEmailPrefix(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
              {options.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  {userEmails?.length === 0 ? "No users found. They need to sign in first." : "No matching users or already added."}
                </p>
              )}
              {options.map((u) => (
                <button
                  key={u.userId}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => handleAdd(u.userId, u.email)}
                  disabled={adding}
                >
                  {u.email}
                </button>
              ))}
            </div>
          </div>

          {members != null && members.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Members</p>
              <ul className="space-y-1">
                {members.map((m) => (
                  <li
                    key={m.userId}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>{m.email}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(m.userId)}
                      aria-label={`Remove ${m.email}`}
                    >
                      <UserMinus className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
