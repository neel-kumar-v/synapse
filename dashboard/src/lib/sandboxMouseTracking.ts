/**
 * Start / stop mouse tracking in the sandbox preview via postMessage.
 *
 * The studio iframe (worker) listens for START_MOUSE_TRACKING, attaches a
 * throttled mousemove listener on the preview iframe's document, and sends
 * MOUSE_SNAPSHOT messages back to the dashboard where SandboxMouseTelemetry
 * writes them to Convex.
 */

const SANDBOX_FRAME_ID = "sandboxFrame";

function getFrame(): HTMLIFrameElement | null {
  if (typeof window === "undefined") return null;
  return document.getElementById(SANDBOX_FRAME_ID) as HTMLIFrameElement | null;
}

export function startMouseTracking(sandboxId: string, sessionId: string): void {
  const frame = getFrame();
  if (!frame?.contentWindow) return;
  frame.contentWindow.postMessage(
    { type: "START_MOUSE_TRACKING", sandboxId, sessionId },
    "*",
  );
}

export function stopMouseTracking(): void {
  const frame = getFrame();
  if (!frame?.contentWindow) return;
  frame.contentWindow.postMessage({ type: "STOP_MOUSE_TRACKING" }, "*");
}
