/**
 * API origin (no trailing slash).
 * - Dev server: defaults to localhost backend.
 * - Production build: uses VITE_API_URL when set (e.g. Railway). If unset, uses
 *   VITE_PRODUCTION_API_URL or the fallback below so the app never calls localhost from the deployed site.
 */
const LOCAL_DEFAULT = "http://localhost:3001";

/** Last-resort API when `vite build` runs without VITE_API_URL (fix misconfigured Railway frontend). */
const PRODUCTION_FALLBACK = "https://humorous-peace-production-1eaf.up.railway.app";

export const API_BASE = (() => {
  const fromEnv = import.meta.env.VITE_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (import.meta.env.DEV) return LOCAL_DEFAULT;
  const alt = import.meta.env.VITE_PRODUCTION_API_URL?.trim();
  if (alt) return alt.replace(/\/+$/, "");
  return PRODUCTION_FALLBACK.replace(/\/+$/, "");
})();
