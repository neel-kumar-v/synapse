export type Theme = "light" | "dark";

export const DARK_MODE_COOKIE = "synapse-theme";

function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(DARK_MODE_COOKIE);
  if (raw === "light" || raw === "dark") return raw;
  return null;
}

export function getDarkModeCookie(): Theme {
  const stored = getStoredTheme();
  if (stored !== null) return stored;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function setDarkModeCookie(theme: Theme): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DARK_MODE_COOKIE, theme);
}
