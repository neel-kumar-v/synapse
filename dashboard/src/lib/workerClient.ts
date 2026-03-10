const WORKER_BASE_URL = process.env.NEXT_PUBLIC_WORKER_BASE_URL;

if (!WORKER_BASE_URL) {
  // This will surface clearly in dev if misconfigured.
  // console.warn(
  //   "NEXT_PUBLIC_WORKER_BASE_URL is not set; Worker calls will fail at runtime.",
  // );
}

async function callWorker<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!WORKER_BASE_URL) {
    throw new Error("Worker base URL is not configured");
  }

  const url = new URL(path, WORKER_BASE_URL);
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Worker returned non-JSON response: ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(
      `Worker call to ${url.pathname} failed (${res.status}): ${JSON.stringify(json)}`,
    );
  }

  return json as T;
}

export type InitSandboxResponse =
  | {
      status: "ready";
      files: string[];
    }
  | {
      error: string;
    };

export async function initSandbox(params: {
  sandboxId: string;
}): Promise<InitSandboxResponse> {
  return callWorker<InitSandboxResponse>(`/s/${params.sandboxId}/api/init`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export type ListFilesResponse = {
  files: string[];
};

export async function listFiles(params: {
  sandboxId: string;
}): Promise<ListFilesResponse> {
  return callWorker<ListFilesResponse>(`/s/${params.sandboxId}/api/files`);
}

export type PromptHistoryEntry = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type PromptResponse =
  | {
      success: true;
      written: string[];
      deleted: string[];
      files: string[];
      refinedPrompt?: string;
    }
  | {
      error: string;
    };

export async function runPrompt(params: {
  sandboxId: string;
  prompt: string;
  history?: PromptHistoryEntry[];
  refinedPrompt?: string;
}): Promise<PromptResponse> {
  return callWorker<PromptResponse>(`/s/${params.sandboxId}/api/prompt`, {
    method: "POST",
    body: JSON.stringify({
      prompt: params.prompt,
      history: params.history,
      ...(params.refinedPrompt !== undefined && { refinedPrompt: params.refinedPrompt }),
    }),
  });
}

export type RefineResponse = {
  refinedPrompt: string;
  refinementSkippedReason?: string;
};

export async function refinePrompt(params: {
  sandboxId: string;
  prompt: string;
}): Promise<RefineResponse> {
  console.log("[refine] prompt sent to worker (transcribed):", params.prompt);
  const result = await callWorker<RefineResponse>(`/s/${params.sandboxId}/api/refine`, {
    method: "POST",
    body: JSON.stringify({ prompt: params.prompt }),
  });
  console.log("[refine] refinedPrompt received from worker:", result.refinedPrompt);
  if (result.refinementSkippedReason) {
    console.warn("[refine] skip reason:", result.refinementSkippedReason);
  }
  return result;
}

