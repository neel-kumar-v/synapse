"use client";

import { useEffect } from "react";
import { suppressDevConsoleNoise } from "@/lib/suppressDevConsoleNoise";

/**
 * In development, suppresses known noisy console warnings (e.g. Next.js HMR
 * "Invalid binary HMR message") so the console stays readable. Renders nothing.
 */
export function DevConsoleFilter() {
  useEffect(() => {
    suppressDevConsoleNoise();
  }, []);
  return null;
}
