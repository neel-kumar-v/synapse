"use client";

/**
 * Snapshot of an element under the cursor (or the nearest interactive ancestor).
 * Use for FrictionPayload.target_element_html and debugging.
 */
export interface MouseTargetSnapshot {
  /** Tag name, e.g. "BUTTON", "A". */
  tagName: string;
  /** outerHTML of the element (clamped for payload size if needed). */
  outerHTML: string;
  /** Optional: id or data attributes for stable identification. */
  id?: string | null;
}

/**
 * Full snapshot returned by the mouse tracker: exact hit target and optional
 * "intent" target (nearest interactive ancestor the user may be trying to use).
 */
export interface MouseTrackingSnapshot {
  /** Document coordinates. */
  position: { x: number; y: number };
  /** Exact element at (x, y) from elementFromPoint. */
  elementUnderCursor: MouseTargetSnapshot | null;
  /**
   * Nearest ancestor (or self) that is focusable/clickable — the element the
   * user is likely intending to interact with (e.g. button when hovering over
   * its label). Use for target_element_html when you care about intent.
   */
  interactiveElement: MouseTargetSnapshot | null;
}

export interface UseMouseTrackerOptions {
  /** Throttle interval in ms (default 100). */
  throttleMs?: number;
  /** Max length for outerHTML in snapshots (default 500). */
  maxOuterHtmlLength?: number;
  /**
   * Radius in px around the cursor to sample for intent. When > 0, we run
   * elementFromPoint at points in this radius and use the nearest interactive
   * element so intent is detected when the cursor is *near* a control (default 12).
   */
  intentRadiusPx?: number;
  /** If false, no listeners are attached (default true). */
  enabled?: boolean;
  /** Called on each throttled update with the new snapshot. */
  onUpdate?: (snapshot: MouseTrackingSnapshot) => void;
}

export interface UseMouseTrackerReturn {
  /** Latest snapshot (null before first move or when disabled). */
  snapshot: MouseTrackingSnapshot | null;
}
