"use client";

import type { PostHogConfig } from "./types";

/**
 * PostHog has been removed from the project. These exports are stubs for
 * compatibility with any remaining references; they do nothing.
 */

export async function initPostHog(_config: PostHogConfig = {}): Promise<boolean> {
  return false;
}

export function isPostHogReady(): boolean {
  return false;
}

export function captureEvent(_name: string, _properties?: Record<string, unknown>): void {
  // no-op
}

export function getSessionReplayUrl(): string {
  return "";
}

export function getDistinctId(): string {
  return "";
}

export function isFrictionEvent(_name: string): boolean {
  return false;
}
