"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAction, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

function parseGithubRepo(repoUrl: string): { owner: string; repo: string } | null {
  const trimmed = repoUrl.trim().replace(/\.git$/, "");
  const match =
    trimmed.match(/github\.com\/([^/]+)\/([^/]+)/) ??
    trimmed.match(/^([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export default function CreateProjectPage() {
  const params = useParams();
  const router = useRouter();
  const user_id = params?.user_id as string | undefined;
  const [name, setName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProject = useMutation(api.projects.createProject);
  const detectProjectType = useAction(api.sandboxes.detectProjectTypeFromRepo);

  async function handleSubmit() {
    if (!user_id || !name.trim()) return;
    const parsed = parseGithubRepo(repoUrl);
    if (!parsed) {
      setError("Enter a valid GitHub repo (e.g. https://github.com/owner/repo or owner/repo)");
      return;
    }
    setError(null);
    setIsCreating(true);

    let detectedType: string | undefined;
    try {
      detectedType = await detectProjectType({
        owner: parsed.owner,
        repo: parsed.repo,
      });
    } catch {
      detectedType = "other";
    }

    try {
      const projectId = await createProject({
        name: name.trim(),
        githubRepo: `${parsed.owner}/${parsed.repo}`,
        projectType: detectedType ?? undefined,
      });
      router.replace(`/${user_id}/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setIsCreating(false);
    }
  }

  if (!user_id) return null;

  const parsed = parseGithubRepo(repoUrl);
  const canSubmit = name.trim().length > 0 && !!parsed && !isCreating;

  return (
    <div className="mx-auto min-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Create project</h1>

      {isCreating ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Creating project…
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="text-sm font-medium block mb-2">
              Project name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My project"
            />
          </div>
          <div>
            <label htmlFor="repo" className="text-sm font-medium block mb-2">
              GitHub repo
            </label>
            <Input
              id="repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo or owner/repo"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Create project
          </Button>
        </div>
      )}
    </div>
  );
}
