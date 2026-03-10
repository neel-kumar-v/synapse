/**
 * Dev-only: suppress known noisy console warnings and errors that don't indicate app bugs.
 * - Next.js HMR "Invalid binary HMR message" / "Invalid message: {isTrusted:true}"
 *   (often caused by extensions or tooling sending non-HMR data to the dev WebSocket)
 *
 * Call once from a client component in development. No-op in production.
 */

const HMR_NOISE_PATTERNS = [
  /Invalid binary HMR message of type \d+/,
  /Invalid message:\s*\{[\s"]*isTrusted[\s"]*:\s*true\s*\}/,
  /Invariant:\s*Invalid binary HMR message/,
];

function isHmrNoise(message: string): boolean {
  return HMR_NOISE_PATTERNS.some((re) => re.test(message));
}

let patched = false;

export function suppressDevConsoleNoise(): void {
  if (typeof window === "undefined" || patched) return;
  if (process.env.NODE_ENV !== "development") return;

  const originalWarn = console.warn;
  console.warn = function (...args: unknown[]) {
    const message = args.map((a) => (typeof a === "string" ? a : String(a))).join(" ");
    if (isHmrNoise(message)) return;
    originalWarn.apply(console, args);
  };

  const originalError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const msg = typeof message === "string" ? message : String(message);
    if (isHmrNoise(msg) || (error?.message && isHmrNoise(error.message))) return true;
    if (originalError) return originalError.call(window, message, source, lineno, colno, error);
    return false;
  };

  patched = true;
}
