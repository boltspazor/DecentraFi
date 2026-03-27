/**
 * API origin (no trailing slash).
 * - Dev server: defaults to localhost backend.
 * - Production build: uses VITE_API_URL when set (e.g. Railway). If unset, uses
 *   VITE_PRODUCTION_API_URL or the fallback below so the app never calls localhost from the deployed site.
 */
const LOCAL_DEFAULT = "http://localhost:3001";

/** Last-resort API when `vite build` runs without VITE_API_URL (fix misconfigured Railway frontend). */
const PRODUCTION_FALLBACK = "https://humorous-peace-production-1eaf.up.railway.app";

/**
 * Use URL origin only (no trailing path) so `${API_BASE}/api/...` never becomes `...app//api/...`
 * when env vars include a trailing slash (common on Railway).
 */
function normalizeApiBase(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) {
    try {
      return new URL(t).origin;
    } catch {
      /* ignore */
    }
  }
  return t.replace(/\/+$/, "");
}

export const API_BASE = (() => {
  const fromEnv = import.meta.env.VITE_API_URL?.trim();
  if (fromEnv) return normalizeApiBase(fromEnv);
  if (import.meta.env.DEV) return normalizeApiBase(LOCAL_DEFAULT);
  const alt = import.meta.env.VITE_PRODUCTION_API_URL?.trim();
  if (alt) return normalizeApiBase(alt);
  return normalizeApiBase(PRODUCTION_FALLBACK);
})();
