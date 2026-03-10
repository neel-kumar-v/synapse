"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  MouseTargetSnapshot,
  MouseTrackingSnapshot,
  UseMouseTrackerOptions,
  UseMouseTrackerReturn,
} from "./types";

const DEFAULT_THROTTLE_MS = 100;
const DEFAULT_MAX_OUTER_HTML_LENGTH = 500;
const DEFAULT_INTENT_RADIUS_PX = 12;

/**
 * Selector for clickable/focusable elements (self or ancestor).
 * Used with element.closest() so we get the nearest interactive when cursor
 * is over a child (e.g. span inside button).
 */
const INTERACTIVE_SELECTOR =
  "a[href], button, input:not([type='hidden']), select, textarea, " +
  "[role='button'], [role='link'], [role='tab'], [role='menuitem'], " +
  "[role='option'], [role='switch'], [role='checkbox'], [role='radio'], " +
  "[role='searchbox'], [role='combobox'], [contenteditable='true'], " +
  "[tabindex]:not([tabindex='-1'])";

/** Nearest interactive ancestor (or self) at one point. */
function findInteractiveAt(element: Element | null): Element | null {
  if (!element) return null;
  try {
    return element.closest(INTERACTIVE_SELECTOR);
  } catch {
    return null;
  }
}

/** Offsets for sampling around cursor (center + 8 points on a circle). */
function getIntentSampleOffsets(radiusPx: number): Array<{ dx: number; dy: number }> {
  if (radiusPx <= 0) return [{ dx: 0, dy: 0 }];
  const out: Array<{ dx: number; dy: number }> = [{ dx: 0, dy: 0 }];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    out.push({
      dx: Math.round(radiusPx * Math.cos(angle)),
      dy: Math.round(radiusPx * Math.sin(angle)),
    });
  }
  return out;
}

/**
 * Find the interactive element the user is most likely intending: sample points
 * in a radius around (clientX, clientY) and pick the interactive element whose
 * center is nearest to the cursor.
 */
function findIntentElement(
  clientX: number,
  clientY: number,
  radiusPx: number
): Element | null {
  const offsets = getIntentSampleOffsets(radiusPx);
  const found = new Set<Element>();
  for (const { dx, dy } of offsets) {
    const el = document.elementFromPoint(clientX + dx, clientY + dy);
    const interactive = findInteractiveAt(el);
    if (interactive) found.add(interactive);
  }
  if (found.size === 0) return null;
  if (found.size === 1) return found.values().next().value ?? null;
  let best: Element | null = null;
  let bestDist = Infinity;
  for (const el of found) {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const d = (clientX - cx) ** 2 + (clientY - cy) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = el;
    }
  }
  return best;
}

function captureSnapshot(
  element: Element | null,
  maxLength: number
): MouseTargetSnapshot | null {
  if (!element || typeof element.outerHTML !== "string") return null;
  const tagName = element.tagName;
  let outerHTML = element.outerHTML;
  if (outerHTML.length > maxLength) {
    outerHTML = outerHTML.slice(0, maxLength) + "...";
  }
  const id = element.id || null;
  return { tagName, outerHTML, id: id || undefined };
}

/**
 * useMouseTracker — throttled cursor position + element under cursor and
 * nearest interactive element (intent). For use in beta-tester sandbox;
 * runs entirely in the browser (document.elementFromPoint).
 *
 * Returns both elementUnderCursor (exact hit) and interactiveElement (intent).
 * When intentRadiusPx > 0, intent is computed by sampling points in that radius
 * so the user gets "what they're aiming at" even when the cursor is just next
 * to a control.
 */
export function useMouseTracker(
  options: UseMouseTrackerOptions = {}
): UseMouseTrackerReturn {
  const {
    throttleMs = DEFAULT_THROTTLE_MS,
    maxOuterHtmlLength = DEFAULT_MAX_OUTER_HTML_LENGTH,
    intentRadiusPx = DEFAULT_INTENT_RADIUS_PX,
    enabled = true,
    onUpdate,
  } = options;

  const [snapshot, setSnapshot] = useState<MouseTrackingSnapshot | null>(null);
  const lastRunRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastCoordsRef = useRef({ x: 0, y: 0 });

  const update = useCallback(
    (clientX: number, clientY: number) => {
      if (typeof document === "undefined") return;
      const el = document.elementFromPoint(clientX, clientY);
      const interactive = findIntentElement(clientX, clientY, intentRadiusPx);

      const elementUnderCursor = captureSnapshot(el, maxOuterHtmlLength);
      const interactiveElement = captureSnapshot(interactive, maxOuterHtmlLength);

      const next: MouseTrackingSnapshot = {
        position: { x: clientX, y: clientY },
        elementUnderCursor,
        interactiveElement,
      };
      setSnapshot(next);
      onUpdate?.(next);
    },
    [maxOuterHtmlLength, intentRadiusPx, onUpdate]
  );

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    const handleMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastRunRef.current >= throttleMs) {
        lastRunRef.current = now;
        update(e.clientX, e.clientY);
        return;
      }
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          lastRunRef.current = Date.now();
          update(lastCoordsRef.current.x, lastCoordsRef.current.y);
        });
      }
      lastCoordsRef.current = { x: e.clientX, y: e.clientY };
    };

    document.addEventListener("mousemove", handleMove, { passive: true });

    return () => {
      document.removeEventListener("mousemove", handleMove);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, throttleMs, update]);

  return { snapshot };
}
