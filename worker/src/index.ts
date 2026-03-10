import { getSandbox, proxyToSandbox } from '@cloudflare/sandbox';
import { STARTER_FILES, STUDIO_HTML } from './starterFiles.generated';

export { Sandbox } from '@cloudflare/sandbox';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function mimeFor(path: string): string {
  const ext = path.slice(path.lastIndexOf('.'));
  return MIME[ext] || 'application/octet-stream';
}

function corsHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return headers;
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: corsHeaders(init?.headers),
  });
}

function parseMultiFile(raw: string): Record<string, string> {
  const files: Record<string, string> = {};
  const blocks = raw.split(/^={3,}FILE:\s*/m);
  for (const block of blocks) {
    if (!block.trim()) continue;
    const nlIdx = block.indexOf('\n');
    if (nlIdx === -1) continue;
    const name = block.slice(0, nlIdx).replace(/={3,}\s*$/, '').trim();
    if (!name) continue;
    let content = block.slice(nlIdx + 1);
    content = content.replace(/\n={3,}ENDFILE={0,3}\s*$/i, '');
    files[name] = content;
  }
  return files;
}

function extractSingleHtml(text: string): string | null {
  const doctypeMatch = text.match(/(<!DOCTYPE[\s\S]*<\/html>)/i);
  if (doctypeMatch) return doctypeMatch[1].trim();
  const htmlTagMatch = text.match(/(<html[\s\S]*<\/html>)/i);
  if (htmlTagMatch) return htmlTagMatch[1].trim();
  return null;
}

const SYSTEM_PROMPT = `You are an expert frontend web developer. You work on a multi-page static web app served from a flat directory.

CURRENT FILE STRUCTURE will be provided. You must return ONLY the files that need to change or be created. Use this exact format — no markdown, no explanations, no commentary outside the file blocks:

===FILE: filename.ext===
file content here
===FILE: another.ext===
file content here

Rules:
- Output ONLY files that changed or are new. Unchanged files should be omitted.
- Each page is a standalone .html file that links to shared styles.css and app.js.
- All pages must share the same <nav> so users can navigate between them.
- Keep CSS in styles.css and JS in app.js (not inline), except where page-specific logic is needed.
- Use modern, clean CSS (custom properties, flexbox/grid, transitions).
- Make everything responsive.
- If the user asks to add a new page, create the .html file AND update the nav in every existing .html file.
- If the user asks to remove a page, delete it by outputting an empty file body AND update navs.
- Start each .html file with <!DOCTYPE html>.
- Never wrap output in markdown code fences.`;

const APP_DIR = '/workspace/app';
const SANDBOX_ID_RE = /^\/s\/([a-z0-9][a-z0-9-]{0,28}[a-z0-9]?)\//;

const SUPERMEMORY_API = 'https://api.supermemory.ai/v3';
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';

/** Refinement system prompt: turns speech-to-text (or chat) into actionable instructions for the code agent. Edit here to change how voice/chat is refined before calling the LLM. */
const GEMINI_REFINE_SYSTEM_PROMPT = `You are a prompt refiner for a code-generation AI. You receive raw user input from speech-to-text (or chat), often long and rambling (e.g. multiple sentences, side comments, filler, or off-topic phrases like "push so Neil can", "make the sandbox analytics").

Your job: output ONE short, clear, actionable instruction for a frontend web developer AI.

Rules:
- Extract only the single clearest app change the user wants. Ignore preamble, side comments, and anything not about changing the app. Example: "spawn? And then once you're done push it so Neil can do the sandbox analytics. Okay so the font size looks too small. I can't see. It's way too small. Can this be bigger, please?" → "Make the text bigger."
- Always refine. Do not echo the input unchanged. Fix speech-to-text artifacts: stuttering, repetition, filler ("um", "uh", "like", "you know"), and obvious ASR errors.
- If the start of the input is garbled or does not match the rest, drop it and keep the clear intent (e.g. "...add a blue button" → "Add a blue button").
- Output one short instruction only. Be specific (e.g. "Make the text bigger" or "Add a blue button"). No preamble, no quotes, no "The user wants..." — just the instruction.
- Preserve the user's intent exactly. Do not add features they did not ask for.
- If the input is empty, unintelligible, or not a request to change the app, output exactly: "No clear request."`;

async function refinePromptWithGemini(apiKey: string, userPrompt: string): Promise<string> {
  const trimmed = userPrompt.trim();
  if (!trimmed) return trimmed;
  console.log('[gemini-refine] SENT (transcribed prompt):', trimmed);
  const url = `${GEMINI_API}/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: GEMINI_REFINE_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: trimmed }] }],
      generationConfig: { maxOutputTokens: 256, temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini refine failed ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };
  if (data.error) throw new Error(data.error.message || 'Gemini API error');
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return text || trimmed;
}

function storeMemory(
  apiKey: string,
  sandboxId: string,
  prompt: string,
  written: string[],
  deleted: string[],
  changedFiles: Record<string, string>,
): Promise<void> {
  const MAX_FILE_CHARS = 2000;

  // Strip code down to identifiers + plain words only.
  // Removes colons, slashes, angle brackets, and any other character that
  // Supermemory's URL/HTML extractor could misinterpret as a URL scheme or tag.
  const sanitizeForMemory = (s: string) =>
    s.replace(/[^a-zA-Z0-9 \n\t.,!?_-]/g, ' ').replace(/\s{3,}/g, '  ');

  let content = `Prompt ${sanitizeForMemory(prompt)}\n`;
  content += `Files written ${written.length ? written.join(' ') : 'none'}\n`;
  content += `Files deleted ${deleted.length ? deleted.join(' ') : 'none'}\n`;
  for (const name of written) {
    const body = changedFiles[name];
    if (body) {
      const snippet = body.length > MAX_FILE_CHARS ? body.slice(0, MAX_FILE_CHARS) : body;
      content += `\nFile ${sanitizeForMemory(name)}\n${sanitizeForMemory(snippet)}\n`;
    }
  }

  const safeContent = content;

  // customId: alphanumeric + hyphens + underscores only, max 100 chars
  const safeId = `chg_${sandboxId}_${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  const containerTag = `sandbox_${sandboxId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);

  const payload = { content: safeContent, containerTag, customId: safeId };
  console.log(`[storeMemory] sending — containerTag:${containerTag} customId:${safeId} contentLen:${content.length}`);

  return fetch(`${SUPERMEMORY_API}/documents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).then(async (res) => {
    const body = await res.text();
    if (!res.ok) console.error(`[storeMemory] failed ${res.status}:`, body);
    else console.log(`[storeMemory] ok ${res.status}:`, body.slice(0, 100));
  }).catch((e) => {
    console.error('[storeMemory] fetch error:', e instanceof Error ? e.message : String(e));
  });
}

async function searchMemories(
  apiKey: string,
  sandboxId: string,
  query: string,
): Promise<string> {
  try {
    const res = await fetch(`${SUPERMEMORY_API}/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        containerTags: [`sandbox_${sandboxId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)],
        limit: 3,
      }),
    });
    if (!res.ok) return '';
    const data = (await res.json()) as {
      results?: Array<{ chunks?: Array<{ content: string; isRelevant: boolean }> }>;
    };
    if (!data.results?.length) return '';
    return data.results
      .flatMap((r) => (r.chunks ?? []).filter((c) => c.isRelevant).map((c) => c.content))
      .filter(Boolean)
      .join('\n---\n');
  } catch {
    return '';
  }
}

// ──────────────────────────────────────────────
// Worker
// ──────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const proxyResponse = await proxyToSandbox(request, env);
    if (proxyResponse) return proxyResponse;

    const url = new URL(request.url);
    const { hostname } = url;

    // ── Root: dashboard is served by Next.js ──
    if (url.pathname === '/' || url.pathname === '') {
      return new Response('Not found', { status: 404 });
    }

    // ── Redirect /s/:id to /s/:id/ ──
    const bareMatch = url.pathname.match(/^\/s\/([a-z0-9][a-z0-9-]{0,28}[a-z0-9]?)$/);
    if (bareMatch) {
      return Response.redirect(`${url.origin}/s/${bareMatch[1]}/`, 301);
    }

    // ── Sandbox routes: /s/:id/... ──
    const idMatch = url.pathname.match(SANDBOX_ID_RE);
    if (!idMatch) {
      return new Response('Not found', { status: 404 });
    }

    const sandboxId = idMatch[1];
    const sub = url.pathname.slice(`/s/${sandboxId}/`.length);

    // ── CORS preflight for API routes ──
    if (request.method === 'OPTIONS' && sub.startsWith('api/')) {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // ── Studio UI ──
    if (sub === '' || sub === 'index.html') {
      return new Response(studioHtml(sandboxId, env as unknown as Record<string, string | undefined>), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // ── Preview: serve files from this sandbox ──
    if (sub.startsWith('preview')) {
      try {
        const sandbox = getSandbox(env.Sandbox, sandboxId);
        let filePath = sub.replace(/^preview\/?/, '') || 'index.html';
        if (filePath.endsWith('/')) filePath += 'index.html';
        const file = await sandbox.readFile(`${APP_DIR}/${filePath}`);
        return new Response(file.content, {
          headers: corsHeaders({ 'Content-Type': mimeFor(filePath) }),
        });
      } catch {
        return new Response('File not found', { status: 404 });
      }
    }

    // ── API: init ──
    if (sub === 'api/init' && request.method === 'POST') {
      const step = { name: 'mkdir' };
      try {
        const sandbox = getSandbox(env.Sandbox, sandboxId);
        await sandbox.mkdir(APP_DIR, { recursive: true });

        step.name = 'listFiles';
        let existingFiles: string[] = [];
        try {
          const listing = await sandbox.listFiles(APP_DIR, { recursive: true });
          existingFiles = listing.files
            .filter((f) => f.type === 'file')
            .map((f) => f.relativePath);
        } catch { /* directory may not exist yet */ }

        if (existingFiles.length === 0) {
          for (const [name, content] of Object.entries(STARTER_FILES)) {
            step.name = `writeFile:${name}`;
            await sandbox.writeFile(`${APP_DIR}/${name}`, content);
          }
          existingFiles = Object.keys(STARTER_FILES);
        }

        // Start HTTP server in the background (non-blocking).
        // Our /preview/* route serves files directly so this isn't critical.
        step.name = 'startServer';
        try {
          const exposedPorts = await sandbox.getExposedPorts(hostname);
          if (!exposedPorts.some((p) => p.port === 8080)) {
            await sandbox.startProcess('python3 -m http.server 8080', { cwd: APP_DIR });
          }
        } catch { /* best-effort */ }

        return json({ status: 'ready', files: existingFiles });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return json({ error: `[step:${step.name}] ${msg}` }, { status: 500 });
      }
    }

    // ── API: list files ──
    if (sub === 'api/files') {
      try {
        const sandbox = getSandbox(env.Sandbox, sandboxId);
        const listing = await sandbox.listFiles(APP_DIR, { recursive: true });
        const names = listing.files
          .filter((f) => f.type === 'file')
          .map((f) => f.relativePath);
        return json({ files: names });
      } catch {
        return json({ files: [] });
      }
    }

    // ── API: refine prompt (Gemini) ──
    if (sub === 'api/refine' && request.method === 'POST') {
      const body = (await request.json()) as { prompt?: string };
      const raw = typeof body.prompt === 'string' ? body.prompt.trim() : '';
      const geminiKey = (env as unknown as Record<string, unknown>).GEMINI_API_KEY as string | undefined;
      const hasKey = Boolean(geminiKey && String(geminiKey).trim().length > 0);
      console.log('[refine] GEMINI_API_KEY present in worker env:', hasKey);
      if (!hasKey) {
        return json({
          refinedPrompt: raw || '',
          refinementSkipped: true,
          refinementSkippedReason: 'GEMINI_API_KEY not set in this worker (local: add to worker/.dev.vars and restart; production: wrangler secret put GEMINI_API_KEY)',
        });
      }
      try {
        const refined = await refinePromptWithGemini(geminiKey!, raw);
        if (refined && refined !== raw) console.log('[refine] →', refined.slice(0, 80) + (refined.length > 80 ? '...' : ''));
        return json({ refinedPrompt: refined || raw });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({
          refinedPrompt: raw,
          refinementFailed: true,
          refinementError: message.slice(0, 120),
        });
      }
    }

    // ── API: prompt ──
    if (sub === 'api/prompt' && request.method === 'POST') {
      try {
        const { prompt, history, refinedPrompt: bodyRefined } = (await request.json()) as {
          prompt: string;
          history?: Array<{ role: string; content: string }>;
          refinedPrompt?: string;
        };

        const geminiKey = (env as unknown as Record<string, unknown>).GEMINI_API_KEY as string | undefined;
        const promptToUse =
          typeof bodyRefined === 'string' && bodyRefined.length > 0
            ? bodyRefined.trim()
            : geminiKey
              ? await refinePromptWithGemini(geminiKey, prompt)
              : prompt;

        const noActionPhrases = [
          'no clear request',
          'no actionable request',
          'unintelligible',
          'nothing to do',
          'no change needed',
        ];
        const lower = promptToUse.toLowerCase().trim();
        const isRejection =
          !promptToUse ||
          promptToUse.length < 2 ||
          noActionPhrases.some((p) => lower === p || lower.startsWith(p + '.') || lower.startsWith(p + ','));
        if (isRejection) {
          const sandbox = getSandbox(env.Sandbox, sandboxId);
          const listing = await sandbox.listFiles(APP_DIR, { recursive: true });
          const files = listing.files.filter((f) => f.type === 'file').map((f) => f.relativePath);
          return json({ success: true, written: [], deleted: [], files, refinedPrompt: promptToUse || '' });
        }

        const sandbox = getSandbox(env.Sandbox, sandboxId);

        const listing = await sandbox.listFiles(APP_DIR, { recursive: true });
        const filePaths = listing.files
          .filter((f) => f.type === 'file')
          .map((f) => f.relativePath);

        const fileContents = await Promise.all(
          filePaths.map((name) => sandbox.readFile(`${APP_DIR}/${name}`).then((f) => ({ name, content: f.content })))
        );

        let currentSnapshot = '';
        for (const { name, content } of fileContents) {
          currentSnapshot += `===FILE: ${name}===\n${content}\n`;
        }

        let memoryContext = '';
        const smKey = (env as unknown as Record<string, unknown>).SUPERMEMORY_API_KEY as string | undefined;
        if (smKey) {
          memoryContext = await searchMemories(smKey, sandboxId, promptToUse);
        }

        const systemContent = memoryContext
          ? `${SYSTEM_PROMPT}\n\nPREVIOUS CHANGES IN THIS SANDBOX (for context):\n${memoryContext}`
          : SYSTEM_PROMPT;

        const messages: Array<{ role: string; content: string }> = [
          { role: 'system', content: systemContent },
        ];
        if (history && history.length > 0) {
          for (const msg of history.slice(-4)) {
            messages.push(msg);
          }
        }
        messages.push({
          role: 'user',
          content: `CURRENT FILES:\n\n${currentSnapshot}\nUSER REQUEST: ${promptToUse}`,
        });

        let aiResponse;
        try {
          aiResponse = await env.AI.run(
            '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
            {
              messages: messages as RoleScopedChatInput[],
              max_tokens: 8192,
              temperature: 0.3,
            }
          );
        } catch (aiErr: unknown) {
          const aiMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
          return json({ error: `AI model error: ${aiMsg}` }, { status: 500 });
        }

        let rawResponse = '';
        if (typeof aiResponse === 'string') {
          rawResponse = aiResponse;
        } else if (aiResponse && typeof aiResponse === 'object' && 'response' in aiResponse) {
          rawResponse = (aiResponse as { response: string }).response;
        }

        let changedFiles = parseMultiFile(rawResponse);
        if (Object.keys(changedFiles).length === 0) {
          // Only fall back to raw-HTML extraction if the response itself IS HTML
          // (i.e. the model output only HTML with no prose). Extracting HTML from
          // a mixed prose+HTML response would silently nuke the whole site.
          const trimmed = rawResponse.trim();
          if (trimmed.startsWith('<!DOCTYPE') || trimmed.toLowerCase().startsWith('<html')) {
            const singleHtml = extractSingleHtml(rawResponse);
            if (singleHtml) changedFiles = { 'index.html': singleHtml };
          }
        }

        if (Object.keys(changedFiles).length === 0) {
          return json(
            { error: 'AI returned an unparseable response. Try rephrasing your prompt.' },
            { status: 422 }
          );
        }

        // ── Validate parsed files before writing ──────────────────────────────
        // Detect rebuild-intent in the prompt so we can allow broader changes.
        const REBUILD_KEYWORDS = ['rewrite', 'rebuild', 'redesign', 'new site', 'start over',
          'start fresh', 'redo', 'recreate', 'completely new', 'from scratch'];
        const isRebuildRequest = REBUILD_KEYWORDS.some(
          (kw) => promptToUse.toLowerCase().includes(kw),
        );

        const safeFiles: Record<string, string> = {};
        for (const [name, content] of Object.entries(changedFiles)) {
          const trimmedContent = content.trim();

          // Empty content signals a deletion — validate below as a group.
          if (trimmedContent === '') {
            safeFiles[name] = '';
            continue;
          }

          // HTML files must have real structure.
          if (name.endsWith('.html')) {
            const lower = trimmedContent.toLowerCase();
            if (trimmedContent.length < 200 || !lower.includes('</html>')) {
              console.warn(`[prompt] skipping ${name}: malformed/too-short HTML (${trimmedContent.length} chars)`);
              continue;
            }
          }

          // CSS files must have meaningful content.
          if (name.endsWith('.css') && trimmedContent.length < 20) {
            console.warn(`[prompt] skipping ${name}: CSS too short (${trimmedContent.length} chars)`);
            continue;
          }

          safeFiles[name] = content;
        }

        // Guard against mass-deletion on non-rebuild prompts.
        // If > 50 % of existing files would be deleted, strip the deletions.
        const pendingDeletions = Object.values(safeFiles).filter((c) => c.trim() === '').length;
        if (!isRebuildRequest && filePaths.length > 0 && pendingDeletions / filePaths.length > 0.5) {
          console.warn(`[prompt] blocking ${pendingDeletions} deletions on non-rebuild prompt`);
          for (const [name, content] of Object.entries(safeFiles)) {
            if (content.trim() === '') delete safeFiles[name];
          }
        }

        if (Object.keys(safeFiles).length === 0) {
          return json(
            { error: 'AI response did not contain any valid file changes. Try rephrasing your prompt.' },
            { status: 422 }
          );
        }

        const written: string[] = [];
        const deleted: string[] = [];
        for (const [name, content] of Object.entries(safeFiles)) {
          if (content.trim() === '') {
            try { await sandbox.deleteFile(`${APP_DIR}/${name}`); deleted.push(name); } catch { /* gone */ }
          } else {
            await sandbox.writeFile(`${APP_DIR}/${name}`, content);
            written.push(name);
          }
        }

        const updated = await sandbox.listFiles(APP_DIR, { recursive: true });
        const allFiles = updated.files
          .filter((f) => f.type === 'file')
          .map((f) => f.relativePath);

        if (smKey) {
          ctx.waitUntil(storeMemory(smKey, sandboxId, promptToUse, written, deleted, safeFiles));
        }

        return json({ success: true, written, deleted, files: allFiles, refinedPrompt: promptToUse });
      } catch (error: unknown) {
        const msg = error instanceof Error
          ? `${error.constructor.name}: ${error.message}${error.stack ? '\n' + error.stack : ''}`
          : String(error);
        return json({ error: msg }, { status: 500 });
      }
    }

    // ── API: upload files (bulk write, replaces all existing files) ──
    if (sub === 'api/upload' && request.method === 'POST') {
      const step = { name: 'parse' };
      try {
        const { files } = (await request.json()) as { files: Record<string, string> };
        if (!files || typeof files !== 'object') {
          return json({ error: 'Expected { files: { [name]: content } }' }, { status: 400 });
        }
        const sandbox = getSandbox(env.Sandbox, sandboxId);

        step.name = 'mkdir';
        await sandbox.mkdir(APP_DIR, { recursive: true });

        // Clear existing files (best-effort — skip on fresh sandbox)
        step.name = 'listFiles';
        try {
          const listing = await sandbox.listFiles(APP_DIR, { recursive: true });
          step.name = 'deleteFiles';
          await Promise.all(
            listing.files
              .filter((f) => f.type === 'file')
              .map((f) => sandbox.deleteFile(`${APP_DIR}/${f.relativePath}`).catch(() => { }))
          );
        } catch { /* directory may be empty on fresh sandbox */ }

        // Write new files, creating subdirs as needed
        step.name = 'writeFiles';
        const fileNames = Object.keys(files);
        const subdirs = [...new Set(
          fileNames.map((n) => n.includes('/') ? `${APP_DIR}/${n.slice(0, n.lastIndexOf('/'))}` : null).filter(Boolean)
        )] as string[];
        for (const dir of subdirs) {
          await sandbox.mkdir(dir, { recursive: true }).catch(() => { });
        }
        for (const [name, content] of Object.entries(files)) {
          step.name = `writeFile:${name}`;
          await sandbox.writeFile(`${APP_DIR}/${name}`, content);
        }

        // Start HTTP server if not already running (best-effort)
        step.name = 'startServer';
        try {
          const exposedPorts = await sandbox.getExposedPorts(request.headers.get('host') ?? '');
          if (!exposedPorts.some((p) => p.port === 8080)) {
            await sandbox.startProcess('python3 -m http.server 8080', { cwd: APP_DIR });
          }
        } catch { /* non-critical */ }

        return json({ ok: true, files: Object.keys(files) });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return json({ error: `[step:${step.name}] ${msg}` }, { status: 500 });
      }
    }

    // ── API: export all file contents ──
    if (sub === 'api/export') {
      try {
        const sandbox = getSandbox(env.Sandbox, sandboxId);
        const listing = await sandbox.listFiles(APP_DIR, { recursive: true });
        const filePaths = listing.files
          .filter((f) => f.type === 'file')
          .map((f) => f.relativePath);

        const fileMap: Record<string, string> = {};
        await Promise.all(
          filePaths.map(async (name) => {
            const f = await sandbox.readFile(`${APP_DIR}/${name}`);
            fileMap[name] = f.content;
          }),
        );

        return json({ files: fileMap });
      } catch {
        return json({ files: {} });
      }
    }

    return new Response('Not found', { status: 404 });
  },
};

function studioHtml(sandboxId: string, env: Record<string, string | undefined>): string {
  const dashboardUrl = (env.DASHBOARD_URL ?? '').replace(/\/$/, '') || 'http://localhost:3000';
  return STUDIO_HTML
    .replaceAll('{{SANDBOX_ID}}', sandboxId)
    .replaceAll('{{DASHBOARD_URL}}', dashboardUrl);
}
