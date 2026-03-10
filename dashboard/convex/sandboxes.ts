import { action, internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || "sandbox";
}

function makeId(name: string): string {
  const base = slugify(name);
  const suffix = Math.random().toString(36).slice(2, 12);
  return `${base}-${suffix}`;
}

export const createSandbox = mutation({
  args: { name: v.string(), projectId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (args.projectId) {
      if (!identity) throw new Error("Must be signed in to create a sandbox in a project");
      const userId = (identity as { subject?: string }).subject;
      if (!userId) throw new Error("Invalid identity");
      const project = await ctx.db
        .query("projects")
        .filter((q) => q.eq(q.field("id"), args.projectId))
        .first();
      if (!project) throw new Error("Project not found");
      if (project.userId !== userId) {
        const member = await ctx.db
          .query("projectMembers")
          .withIndex("by_projectId_userId", (q) =>
            q.eq("projectId", args.projectId!).eq("userId", userId),
          )
          .first();
        if (!member) throw new Error("You do not have access to this project");
      }
    }
    const name = args.name.trim() || "Untitled";
    const id = makeId(name);
    const now = Date.now();
    await ctx.db.insert("sandboxes", {
      id,
      name,
      createdAt: now,
      lastOpenedAt: now,
      projectId: args.projectId,
    });
    return id;
  },
});

export const insertTesterSandbox = internalMutation({
  args: {
    id: v.string(),
    name: v.string(),
    testerEmail: v.string(),
    testerName: v.optional(v.string()),
    now: v.number(),
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sandboxes", {
      id: args.id,
      name: args.name,
      testerEmail: args.testerEmail,
      testerName: args.testerName,
      createdAt: args.now,
      lastOpenedAt: args.now,
      projectId: args.projectId,
    });
  },
});

export const updateSandboxTester = internalMutation({
  args: {
    id: v.string(),
    testerEmail: v.string(),
    testerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("sandboxes")
      .withIndex("by_sandbox_id", (q) => q.eq("id", args.id))
      .unique();
    if (!row) throw new Error(`Sandbox ${args.id} not found`);
    await ctx.db.patch(row._id, {
      testerEmail: args.testerEmail,
      testerName: args.testerName,
    });
  },
});

export const inviteTesters = action({
  args: {
    testers: v.array(
      v.object({
        name: v.string(),
        email: v.string(),
      }),
    ),
    sandboxId: v.optional(v.string()),
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
    const results: { sandboxId: string; email: string; name: string }[] = [];

    for (const tester of args.testers) {
      const rawName = tester.name.trim();
      const rawEmail = tester.email.trim().toLowerCase();
      if (!rawEmail) continue;

      const sandboxName = rawName || rawEmail;

      let id: string;
      if (args.sandboxId) {
        // Attach tester to the existing sandbox (e.g. created by import flow)
        id = args.sandboxId;
        await ctx.runMutation(internal.sandboxes.updateSandboxTester, {
          id,
          testerEmail: rawEmail,
          testerName: rawName || undefined,
        });
      } else {
        // Normal invite: create a fresh sandbox for this tester
        id = makeId(sandboxName);
        await ctx.runMutation(internal.sandboxes.insertTesterSandbox, {
          id,
          name: sandboxName,
          testerEmail: rawEmail,
          testerName: rawName || undefined,
          now,
          projectId: args.projectId,
        });

        // If the project has a GitHub repo, import it into the new sandbox
        if (args.projectId) {
          const project = await ctx.runQuery(internal.projects.getProjectById, {
            projectId: args.projectId,
          });
          if (project?.githubRepo) {
            try {
              await ctx.runAction(api.sandboxes.importFromGitHub, {
                sandboxId: id,
                repoUrl: project.githubRepo,
              });
            } catch (e) {
              console.error(`[inviteTesters] GitHub import failed for sandbox ${id}:`, e instanceof Error ? e.message : String(e));
            }
          }
        }
      }

      const sandboxUrl = `${siteUrl}/s/${id}`;

      const displayName = rawName || "there";
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Synapse <onboarding@resend.dev>",
          to: rawEmail,
          subject: `You've been invited to a Synapse sandbox`,
          html: `
            <div
              style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0b0d11;color:#e4e7ed;border-radius:12px">
              <div style="margin-bottom:24px; margin-left: -20px">
                  <span style="margin-left: -10px; font-weight:700;font-size:32px;vertical-align:top">Synapse</span>
              </div>
              <h1 style="font-size:22px;font-weight:600;margin:0 0 10px">Hey ${displayName}, you're invited!</h1>
              <p style="color:#7a8194;font-size:14px;line-height:1.6;margin:0 0 8px">
                  You've been given access to an alpha version of [insert app name] for user testing!
              </p>
              <p style="color:#7a8194;font-size:14px;line-height:1.6;margin:0 0 24px">
                  Your <a style="color:#ffffff" href="${sandboxUrl}">sandbox</a> is ready. Sign up or sign in to start
                  building.
              </p>
              <a href="${sandboxUrl}"
                  style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#cb7a6c,#af560e);color:#fff;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none">
                  Open My Sandbox
              </a>
              <p style="color:#7a8194;font-size:12px;margin-top:24px">
                  If you weren't expecting this invite, you can safely ignore this email.
              </p>
              <p style="color:#7a8194;font-size:12px;margin-top: -4px;">
                  Setup your own sandbox <a style="color:#aaaaaa" href="https://synapse.dev/docs/getting-started/quickstart">here</a>.
              </p>
          </div>
          `,
        }),
      }).then(async (res) => {
        const body = await res.json();
        // console.log(`[Resend invite] ${rawEmail} →`, res.status, JSON.stringify(body));
        void body;
      });

      results.push({ sandboxId: id, email: rawEmail, name: sandboxName });
    }

    return results;
  },
});

// ─────────────────────────────────────────────────────────────
// GitHub import: fetch repo source, transform JSX, upload to sandbox
// ─────────────────────────────────────────────────────────────

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const cleaned = url.trim().replace(/\.git$/, '');
  // Full URL: https://github.com/owner/repo
  const fullMatch = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (fullMatch) return { owner: fullMatch[1], repo: fullMatch[2] };
  // Short form: owner/repo
  const shortMatch = cleaned.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2] };
  return null;
}

async function fetchGitHubFile(owner: string, repo: string, path: string, token?: string): Promise<string | null> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github.raw+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });
  if (!res.ok) return null;
  return res.text();
}

async function fetchGitHubTree(owner: string, repo: string, token?: string): Promise<{ path: string; type: string }[]> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, { headers });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json() as { tree: { path: string; type: string }[] };
  return data.tree;
}

function findFile(fileMap: Record<string, string>, relativePath: string): string | null {
  const candidates = [relativePath, `${relativePath}.tsx`, `${relativePath}.ts`, `${relativePath}.jsx`, `${relativePath}.js`];
  for (const c of candidates) {
    for (const [key, content] of Object.entries(fileMap)) {
      if (key === c || key.endsWith(`/${c}`)) return content;
    }
  }
  return null;
}

function inlineLocalImports(code: string, fileMap: Record<string, string>, visited = new Set<string>()): string {
  return code.replace(
    /^import\s+[\s\S]*?\s+from\s+['"]\.\/([^'"]+)['"]/gm,
    (match, relativePath) => {
      if (visited.has(relativePath)) return '';
      visited.add(relativePath);
      const content = findFile(fileMap, relativePath);
      if (!content) return match;
      // Recursively inline any local imports in the inlined file
      return inlineLocalImports(content, fileMap, visited);
    }
  );
}

function flattenForBrowser(code: string): string {
  // Strip all remaining import statements (package imports, CSS imports, etc.)
  let result = code.replace(/^import\s+.*$/gm, '');
  // Strip export default
  result = result.replace(/^export\s+default\s+/gm, '');
  // Strip export keyword from named exports
  result = result.replace(/^export\s+(?=(?:function|const|let|var|class)\s)/gm, '');
  return result;
}

function generateIndexHtml(
  title: string,
  allSources: Record<string, string>,
  cssContent: string,
  deps: Record<string, string>,
  entryFile: string,
): string {
  const reactVer = (deps['react'] ?? '18').replace(/[^0-9.]/g, '');

  let entryCode = allSources[entryFile] ?? '';
  entryCode = inlineLocalImports(entryCode, allSources);
  entryCode = flattenForBrowser(entryCode);

  const hooksPreamble = `const { useState, useEffect, useRef, useCallback, useMemo, useContext, useReducer, createContext, createElement, Fragment, StrictMode } = React;`;

  // Escape the source so it can live safely inside a JS template literal
  const escapedCode = (hooksPreamble + '\n\n' + entryCode)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div id="root"></div>
  <div id="_err" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:#1a1a2e;color:#ff6b6b;font-family:monospace;padding:32px;z-index:9999;overflow:auto;white-space:pre-wrap;font-size:13px;line-height:1.6;border-left:4px solid #ff6b6b"></div>
  <script crossorigin src="https://unpkg.com/react@${reactVer}/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@${reactVer}/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script>
    function showError(label, err) {
      var el = document.getElementById('_err');
      el.style.display = 'block';
      el.textContent = label + '\\n\\n' + (err && err.stack ? err.stack : String(err));
    }
    window.addEventListener('unhandledrejection', function(e) {
      showError('Unhandled Promise Rejection', e.reason);
    });
    try {
      var src = \`${escapedCode}\`;
      var compiled;
      try {
        compiled = Babel.transform(src, { presets: ['react', 'typescript'], filename: 'app.tsx' }).code;
      } catch(e) {
        showError('Babel Transform Error', e);
        throw e;
      }
      try {
        // eslint-disable-next-line no-eval
        (0, eval)(compiled);
      } catch(e) {
        showError('Runtime Error', e);
        throw e;
      }
    } catch(e) {
      // already shown
    }
  </script>
</body>
</html>`;
}

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out']);

/**
 * Detect project type from a GitHub repo (for create-project flow).
 * Uses fetchGitHubFile to check package.json and config files.
 */
export const detectProjectTypeFromRepo = action({
  args: {
    owner: v.string(),
    repo: v.string(),
    githubToken: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const token = args.githubToken ?? process.env.GITHUB_TOKEN;
    const pkgJson = await fetchGitHubFile(args.owner, args.repo, "package.json", token);
    if (pkgJson) {
      try {
        const pkg = JSON.parse(pkgJson) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps["next"]) return "nextjs";
        if (deps["vite"]) return "vite";
        if (deps["vue"] || deps["vue-router"]) return "vue";
        if (deps["react"]) return "react";
      } catch { /* ignore */ }
    }
    const nextConfig = await fetchGitHubFile(args.owner, args.repo, "next.config.js", token)
      ?? await fetchGitHubFile(args.owner, args.repo, "next.config.mjs", token)
      ?? await fetchGitHubFile(args.owner, args.repo, "next.config.ts", token);
    if (nextConfig) return "nextjs";
    const viteConfig = await fetchGitHubFile(args.owner, args.repo, "vite.config.ts", token)
      ?? await fetchGitHubFile(args.owner, args.repo, "vite.config.js", token);
    if (viteConfig) return "vite";
    return "other";
  },
});

export const importFromGitHub = action({
  args: {
    sandboxId: v.string(),
    repoUrl: v.string(),
    githubToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const parsed = parseGitHubUrl(args.repoUrl);
    if (!parsed) throw new Error('Invalid GitHub URL');
    const { owner, repo } = parsed;
    const token = args.githubToken ?? process.env.GITHUB_TOKEN;

    // Fetch full file tree
    const tree = await fetchGitHubTree(owner, repo, token);
    const sourceFiles = tree.filter(({ path, type }) => {
      if (type !== 'blob') return false;
      const parts = path.split('/');
      if (parts.some((p) => SKIP_DIRS.has(p))) return false;
      const ext = path.slice(path.lastIndexOf('.'));
      return SOURCE_EXTS.has(ext) || path.endsWith('.css') || path.endsWith('.html');
    });

    // Fetch package.json for dependency versions
    let deps: Record<string, string> = {};
    const pkgJson = await fetchGitHubFile(owner, repo, 'package.json', token);
    if (pkgJson) {
      try {
        const pkg = JSON.parse(pkgJson) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
        deps = { ...pkg.dependencies, ...pkg.devDependencies };
      } catch { /* ignore parse errors */ }
    }

    // Fetch all source files
    const allSources: Record<string, string> = {};
    let cssContent = '';
    await Promise.all(
      sourceFiles.map(async ({ path }) => {
        const content = await fetchGitHubFile(owner, repo, path, token);
        if (content === null) return;
        if (path.endsWith('.css')) {
          cssContent += content + '\n';
        } else {
          allSources[path] = content;
        }
      })
    );

    // Detect entry file
    const entryFile = ['src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx', 'src/App.tsx']
      .find((e) => allSources[e]) ?? Object.keys(allSources)[0];

    // Build a single-page app with Babel standalone for JSX
    const generatedHtml = generateIndexHtml(repo, allSources, cssContent, deps, entryFile);

    const outputFiles: Record<string, string> = { 'index.html': generatedHtml };
    if (cssContent) outputFiles['styles.css'] = cssContent;

    // Upload to sandbox via worker
    const workerBase = process.env.WORKER_BASE_URL;
    if (!workerBase) throw new Error('WORKER_BASE_URL not set in Convex env');
    const uploadUrl = `${workerBase.replace(/\/$/, '')}/s/${args.sandboxId}/api/upload`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: outputFiles }),
    });
    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Upload failed (${uploadRes.status}): ${err || uploadRes.statusText}. Ensure WORKER_BASE_URL in Convex env points to your deployed worker (not localhost) and the worker is deployed with the latest code.`);
    }

    return { ok: true, files: Object.keys(outputFiles) };
  },
});

export const listSandboxes = query({
  args: { projectId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.projectId) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) return [];
      const userId = (identity as { subject?: string }).subject;
      if (!userId) return [];
      const project = await ctx.db
        .query("projects")
        .filter((q) => q.eq(q.field("id"), args.projectId))
        .first();
      if (!project) return [];
      if (project.userId !== userId) {
        const member = await ctx.db
          .query("projectMembers")
          .withIndex("by_projectId_userId", (q) =>
            q.eq("projectId", args.projectId!).eq("userId", userId),
          )
          .first();
        if (!member) return [];
      }
      const list = await ctx.db
        .query("sandboxes")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId!))
        .collect();
      return list.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
    }
    return await ctx.db
      .query("sandboxes")
      .withIndex("by_lastOpenedAt")
      .order("desc")
      .collect();
  },
});

/**
 * Returns the sandbox for the given id only if the current user has access (project owner/member or legacy sandbox).
 * Used to gate /s/[id].
 */
export const getSandboxForCurrentUser = query({
  args: { sandboxId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("sandboxes")
      .filter((q) => q.eq(q.field("id"), args.sandboxId))
      .first();
    if (!row) return null;
    if (!row.projectId) return row;
    const projectId = row.projectId;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = (identity as { subject?: string }).subject;
    if (!userId) return null;
    const project = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("id"), projectId))
      .first();
    if (!project) return null;
    if (project.userId === userId) return row;
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_projectId_userId", (q) =>
        q.eq("projectId", projectId).eq("userId", userId),
      )
      .first();
    return member ? row : null;
  },
});

async function userCanAccessSandbox(ctx: MutationCtx, sandboxId: string): Promise<boolean> {
  const row = await ctx.db
    .query("sandboxes")
    .filter((q) => q.eq(q.field("id"), sandboxId))
    .first();
  if (!row) return false;
  if (!row.projectId) return true;
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  const userId = (identity as { subject?: string }).subject;
  if (!userId) return false;
  const project = await ctx.db
    .query("projects")
    .filter((q) => q.eq(q.field("id"), row.projectId))
    .first();
  if (!project) return false;
  if (project.userId === userId) return true;
  const member = await ctx.db
    .query("projectMembers")
    .withIndex("by_projectId_userId", (q) =>
      q.eq("projectId", row.projectId!).eq("userId", userId),
    )
    .first();
  return !!member;
}

export const updateLastOpened = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("sandboxes")
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();
    if (!row) return null;
    const canAccess = await userCanAccessSandbox(ctx, args.id);
    if (!canAccess) throw new Error("You do not have access to this sandbox");
    await ctx.db.patch(row._id, { lastOpenedAt: Date.now() });
    return null;
  },
});

export const removeSandbox = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("sandboxes")
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();
    if (!row) return null;
    const canAccess = await userCanAccessSandbox(ctx, args.id);
    if (!canAccess) throw new Error("You do not have access to this sandbox");
    await ctx.db.delete(row._id);
    return null;
  },
});

export const renameSandbox = mutation({
  args: { id: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const name = args.name.trim() || "Untitled";
    const row = await ctx.db
      .query("sandboxes")
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();
    if (!row) return null;
    const canAccess = await userCanAccessSandbox(ctx, args.id);
    if (!canAccess) throw new Error("You do not have access to this sandbox");
    await ctx.db.patch(row._id, { name });
    return null;
  },
});

/**
 * Calls the Cloudflare worker to initialize the sandbox (create files, start server).
 * Only the assigned tester can start the sandbox; identity is verified before calling the worker.
 * Set WORKER_BASE_URL in Convex dashboard environment for this to work.
 */
export const ensureSandboxOnWorker = action({
  args: { sandboxId: v.string() },
  handler: async (ctx, args) => {
    const sandbox = await ctx.runQuery(api.sandboxes.getSandboxForCurrentUser, {
      sandboxId: args.sandboxId,
    });
    if (!sandbox) {
      throw new Error("You do not have access to this sandbox");
    }
    const base = process.env.WORKER_BASE_URL;
    if (!base) {
      throw new Error("WORKER_BASE_URL is not set in Convex environment");
    }
    const url = `${base.replace(/\/$/, "")}/s/${args.sandboxId}/api/init`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Worker init failed (${res.status}): ${text}`);
    }
    return null;
  },
});

const GITHUB_API = "https://api.github.com";
const SUPERMEMORY_API = "https://api.supermemory.ai/v3";

async function githubFetch(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

/**
 * Creates a GitHub PR with the current sandbox files.
 * The target repo is taken from the project the sandbox belongs to.
 * Requires WORKER_BASE_URL, GITHUB_TOKEN, and optionally SUPERMEMORY_API_KEY
 * to be set in the Convex environment.
 */
export const createPullRequest = action({
  args: { sandboxId: v.string() },
  handler: async (ctx, args) => {
    const workerBase = process.env.WORKER_BASE_URL;
    const githubToken = process.env.GITHUB_TOKEN;
    const smKey = process.env.SUPERMEMORY_API_KEY;

    if (!workerBase) throw new Error("WORKER_BASE_URL is not set");
    if (!githubToken) throw new Error("GITHUB_TOKEN is not set");

    // Resolve the GitHub repo from the project the sandbox belongs to
    const sandbox = await ctx.runQuery(api.sandboxes.getSandboxForCurrentUser, {
      sandboxId: args.sandboxId,
    });
    if (!sandbox) throw new Error("Sandbox not found or access denied");

    let githubRepo: string | undefined;
    if (sandbox.projectId) {
      const project = await ctx.runQuery(internal.projects.getProjectById, {
        projectId: sandbox.projectId,
      });
      githubRepo = project?.githubRepo;
    }
    // Fall back to env var for backwards compatibility
    githubRepo = githubRepo ?? process.env.GITHUB_REPO;
    if (!githubRepo) throw new Error("No GitHub repo configured for this project. Set one when creating the project.");

    const exportUrl = `${workerBase.replace(/\/$/, "")}/s/${args.sandboxId}/api/export`;
    const exportRes = await fetch(exportUrl);
    if (!exportRes.ok) {
      throw new Error(`Failed to export sandbox files: ${exportRes.status}`);
    }
    const { files } = (await exportRes.json()) as {
      files: Record<string, string>;
    };
    if (!files || Object.keys(files).length === 0) {
      throw new Error("No files found in sandbox");
    }

    let changeHistory = "";
    if (smKey) {
      try {
        const searchRes = await fetch(`${SUPERMEMORY_API}/search`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${smKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            q: `all changes in sandbox ${args.sandboxId}`,
            containerTags: [`sandbox_${args.sandboxId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)],
            limit: 10,
          }),
        });
        const rawBody = await searchRes.text();
        // console.log(`[createPR] supermemory search status: ${searchRes.status}, body: ${rawBody.slice(0, 500)}`);
        if (searchRes.ok) {
          const data = JSON.parse(rawBody) as Record<string, unknown>;
          const results = (data.results ?? []) as Array<{ title?: string; createdAt?: string }>;
          const titles = results
            .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime())
            .map((r) => r.title?.trim())
            .filter(Boolean) as string[];
          changeHistory = titles.length > 0 ? titles.map((t) => `- ${t}`).join("\n") : "";
          // console.log(`[createPR] changeHistory length: ${changeHistory.length}`);
        }
      } catch (e) {
        // console.error(`[createPR] supermemory search error:`, e instanceof Error ? e.message : String(e));
        void e;
      }
    }

    const branchName = `sandbox/${args.sandboxId}`;

    const mainRef = await githubFetch(
      `/repos/${githubRepo}/git/ref/heads/main`,
      githubToken,
    );
    if (!mainRef.ok) {
      throw new Error(`Failed to get main branch: ${mainRef.status}`);
    }
    const mainData = (await mainRef.json()) as {
      object: { sha: string };
    };
    const baseSha = mainData.object.sha;

    const treeEntries = Object.entries(files).map(([path, content]) => ({
      path: `sandbox/${args.sandboxId}/${path}`,
      mode: "100644" as const,
      type: "blob" as const,
      content,
    }));

    const treeRes = await githubFetch(
      `/repos/${githubRepo}/git/trees`,
      githubToken,
      {
        method: "POST",
        body: JSON.stringify({ base_tree: baseSha, tree: treeEntries }),
      },
    );
    if (!treeRes.ok) {
      throw new Error(`Failed to create tree: ${treeRes.status}`);
    }
    const treeSha = ((await treeRes.json()) as { sha: string }).sha;

    const commitRes = await githubFetch(
      `/repos/${githubRepo}/git/commits`,
      githubToken,
      {
        method: "POST",
        body: JSON.stringify({
          message: `sandbox: ${args.sandboxId}`,
          tree: treeSha,
          parents: [baseSha],
        }),
      },
    );
    if (!commitRes.ok) {
      throw new Error(`Failed to create commit: ${commitRes.status}`);
    }
    const commitSha = ((await commitRes.json()) as { sha: string }).sha;

    const existingBranch = await githubFetch(
      `/repos/${githubRepo}/git/ref/heads/${branchName}`,
      githubToken,
    );
    if (existingBranch.ok) {
      await githubFetch(
        `/repos/${githubRepo}/git/refs/heads/${branchName}`,
        githubToken,
        {
          method: "PATCH",
          body: JSON.stringify({ sha: commitSha, force: true }),
        },
      );
    } else {
      const refRes = await githubFetch(
        `/repos/${githubRepo}/git/refs`,
        githubToken,
        {
          method: "POST",
          body: JSON.stringify({
            ref: `refs/heads/${branchName}`,
            sha: commitSha,
          }),
        },
      );
      if (!refRes.ok) {
        throw new Error(`Failed to create branch: ${refRes.status}`);
      }
    }

    const prBody = changeHistory
      ? `## Changes\n\n${changeHistory}`
      : `Auto-generated from sandbox ${args.sandboxId}.`;

    const prRes = await githubFetch(
      `/repos/${githubRepo}/pulls`,
      githubToken,
      {
        method: "POST",
        body: JSON.stringify({
          title: `Sandbox: ${args.sandboxId}`,
          head: branchName,
          base: "main",
          body: prBody,
        }),
      },
    );

    let prUrl: string;
    let prNumber: number;

    if (prRes.ok) {
      const prData = (await prRes.json()) as {
        html_url: string;
        number: number;
      };
      prUrl = prData.html_url;
      prNumber = prData.number;
    } else {
      const errBody = (await prRes.json()) as {
        errors?: Array<{ message?: string }>;
      };
      const alreadyExists = errBody.errors?.some((e) =>
        e.message?.includes("A pull request already exists"),
      );
      if (alreadyExists) {
        const listRes = await githubFetch(
          `/repos/${githubRepo}/pulls?head=${githubRepo.split("/")[0]}:${branchName}&state=open`,
          githubToken,
        );
        const prs = (await listRes.json()) as Array<{
          html_url: string;
          number: number;
        }>;
        if (prs.length > 0) {
          prUrl = prs[0].html_url;
          prNumber = prs[0].number;
          // Update the PR description with the latest change history
          await githubFetch(
            `/repos/${githubRepo}/pulls/${prNumber}`,
            githubToken,
            {
              method: "PATCH",
              body: JSON.stringify({ body: prBody }),
            },
          );
        } else {
          throw new Error(`Failed to create PR: ${prRes.status}`);
        }
      } else {
        throw new Error(`Failed to create PR: ${prRes.status}`);
      }
    }

    await ctx.runMutation(internal.sandboxes.updatePrInfo, {
      id: args.sandboxId,
      prUrl,
      prNumber,
      githubRepo,
    });

    return { prUrl, prNumber };
  },
});

/**
 * Creates a single aggregated PR that combines files from multiple sandboxes.
 * Each sandbox's files are placed under sandbox/{sandboxId}/ in the branch.
 * Only the project owner can call this.
 */
export const aggregatePullRequests = action({
  args: {
    projectId: v.string(),
    sandboxIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.sandboxIds.length === 0) throw new Error("No sandboxes selected");

    const workerBase = process.env.WORKER_BASE_URL;
    const githubToken = process.env.GITHUB_TOKEN;
    if (!workerBase) throw new Error("WORKER_BASE_URL is not set");
    if (!githubToken) throw new Error("GITHUB_TOKEN is not set");

    // Verify caller owns the project
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Must be signed in");
    const userId = (identity as { subject?: string }).subject;
    if (!userId) throw new Error("Invalid identity");

    const project = await ctx.runQuery(internal.projects.getProjectById, {
      projectId: args.projectId,
    });
    if (!project) throw new Error("Project not found");
    if (project.userId !== userId) throw new Error("Only the project owner can aggregate PRs");

    const githubRepo = project.githubRepo ?? process.env.GITHUB_REPO;
    if (!githubRepo) throw new Error("No GitHub repo configured for this project");

    // Get main branch SHA
    const mainRef = await githubFetch(
      `/repos/${githubRepo}/git/ref/heads/main`,
      githubToken,
    );
    if (!mainRef.ok) throw new Error(`Failed to get main branch: ${mainRef.status}`);
    const baseSha = ((await mainRef.json()) as { object: { sha: string } }).object.sha;

    // Export files from each sandbox and build tree entries
    type TreeEntry = { path: string; mode: "100644"; type: "blob"; content: string };
    const treeEntries: TreeEntry[] = [];
    const included: string[] = [];
    const skipped: string[] = [];

    for (const sandboxId of args.sandboxIds) {
      try {
        const exportUrl = `${workerBase.replace(/\/$/, "")}/s/${sandboxId}/api/export`;
        const exportRes = await fetch(exportUrl);
        if (!exportRes.ok) { skipped.push(sandboxId); continue; }
        const { files } = (await exportRes.json()) as { files: Record<string, string> };
        if (!files || Object.keys(files).length === 0) { skipped.push(sandboxId); continue; }
        for (const [path, content] of Object.entries(files)) {
          treeEntries.push({ path: `sandbox/${sandboxId}/${path}`, mode: "100644", type: "blob", content });
        }
        included.push(sandboxId);
      } catch {
        skipped.push(sandboxId);
      }
    }

    if (treeEntries.length === 0) throw new Error("No files could be exported from any selected sandbox");

    // ── Fetch per-sandbox change history from Supermemory ────────────────────
    const smKey = process.env.SUPERMEMORY_API_KEY;
    const sandboxHistories: Record<string, string[]> = {};

    if (smKey) {
      await Promise.all(
        included.map(async (sandboxId) => {
          try {
            const searchRes = await fetch(`${SUPERMEMORY_API}/search`, {
              method: "POST",
              headers: { Authorization: `Bearer ${smKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                q: `all changes in sandbox ${sandboxId}`,
                containerTags: [`sandbox_${sandboxId}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100)],
                limit: 10,
              }),
            });
            if (!searchRes.ok) return;
            const data = (await searchRes.json()) as Record<string, unknown>;
            const results = (data.results ?? []) as Array<{ title?: string; createdAt?: string }>;
            const titles = results
              .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime())
              .map((r) => r.title?.trim())
              .filter(Boolean) as string[];
            if (titles.length > 0) sandboxHistories[sandboxId] = titles;
          } catch {
            // non-critical — skip silently
          }
        }),
      );
    }

    // Create git tree
    const treeRes = await githubFetch(`/repos/${githubRepo}/git/trees`, githubToken, {
      method: "POST",
      body: JSON.stringify({ base_tree: baseSha, tree: treeEntries }),
    });
    if (!treeRes.ok) throw new Error(`Failed to create tree: ${treeRes.status}`);
    const treeSha = ((await treeRes.json()) as { sha: string }).sha;

    // Create commit
    const commitRes = await githubFetch(`/repos/${githubRepo}/git/commits`, githubToken, {
      method: "POST",
      body: JSON.stringify({
        message: `aggregated: ${included.length} sandbox${included.length === 1 ? "" : "es"}\n\n${included.map((id) => `- sandbox/${id}`).join("\n")}`,
        tree: treeSha,
        parents: [baseSha],
      }),
    });
    if (!commitRes.ok) throw new Error(`Failed to create commit: ${commitRes.status}`);
    const commitSha = ((await commitRes.json()) as { sha: string }).sha;

    // Create or force-update branch
    const branchName = `aggregated/${args.projectId}`;
    const existingBranch = await githubFetch(
      `/repos/${githubRepo}/git/ref/heads/${branchName}`,
      githubToken,
    );
    if (existingBranch.ok) {
      await githubFetch(`/repos/${githubRepo}/git/refs/heads/${branchName}`, githubToken, {
        method: "PATCH",
        body: JSON.stringify({ sha: commitSha, force: true }),
      });
    } else {
      const refRes = await githubFetch(`/repos/${githubRepo}/git/refs`, githubToken, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: commitSha }),
      });
      if (!refRes.ok) throw new Error(`Failed to create branch: ${refRes.status}`);
    }

    // ── Build PR body with per-sandbox history sections ──────────────────────
    const sandboxSections = included.map((sandboxId) => {
      const history = sandboxHistories[sandboxId];
      const header = `### \`sandbox/${sandboxId}\``;
      if (history && history.length > 0) {
        return `${header}\n${history.map((t) => `- ${t}`).join("\n")}`;
      }
      return `${header}\n_No change history recorded._`;
    });

    const prBody = [
      `## Aggregated changes — ${project.name}`,
      ``,
      `${included.length} sandbox${included.length === 1 ? "" : "es"} combined into this PR.`,
      ``,
      ...sandboxSections,
      ...(skipped.length > 0
        ? ["", `> **${skipped.length} sandbox${skipped.length === 1 ? "" : "es"} skipped** (no files or export failed)`]
        : []),
    ].join("\n");

    // Build a meaningful title from the first few distinct change titles across all sandboxes
    const allTitles = included.flatMap((id) => sandboxHistories[id] ?? []);
    const prTitle = allTitles.length > 0
      ? `${project.name}: ${allTitles.slice(0, 2).join("; ")}${allTitles.length > 2 ? "…" : ""}`
      : `Aggregated: ${included.length} sandbox${included.length === 1 ? "" : "es"} (${project.name})`;

    const prRes = await githubFetch(`/repos/${githubRepo}/pulls`, githubToken, {
      method: "POST",
      body: JSON.stringify({
        title: prTitle.slice(0, 255),
        head: branchName,
        base: "main",
        body: prBody,
      }),
    });

    let prUrl: string;
    let prNumber: number;

    if (prRes.ok) {
      const d = (await prRes.json()) as { html_url: string; number: number };
      prUrl = d.html_url;
      prNumber = d.number;
    } else {
      const errBody = (await prRes.json()) as { errors?: Array<{ message?: string }> };
      const alreadyExists = errBody.errors?.some((e) =>
        e.message?.includes("A pull request already exists"),
      );
      if (alreadyExists) {
        const listRes = await githubFetch(
          `/repos/${githubRepo}/pulls?head=${githubRepo.split("/")[0]}:${branchName}&state=open`,
          githubToken,
        );
        const prs = (await listRes.json()) as Array<{ html_url: string; number: number }>;
        if (prs.length > 0) {
          prUrl = prs[0].html_url;
          prNumber = prs[0].number;
          await githubFetch(`/repos/${githubRepo}/pulls/${prNumber}`, githubToken, {
            method: "PATCH",
            body: JSON.stringify({ title: prTitle.slice(0, 255), body: prBody }),
          });
        } else {
          throw new Error(`Failed to create aggregated PR: ${prRes.status}`);
        }
      } else {
        throw new Error(`Failed to create aggregated PR: ${prRes.status}`);
      }
    }

    return { prUrl, prNumber, included, skipped };
  },
});

export const updatePrInfo = internalMutation({
  args: {
    id: v.string(),
    prUrl: v.string(),
    prNumber: v.number(),
    githubRepo: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("sandboxes")
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();
    if (row) {
      await ctx.db.patch(row._id, {
        prUrl: args.prUrl,
        prNumber: args.prNumber,
        githubRepo: args.githubRepo,
      });
    }
  },
});

