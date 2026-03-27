/**
 * Aceternity-style layered background: soft aurora blobs + masked grid (no extra deps).
 */
export function AppBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[var(--app-bg)] transition-colors duration-300" />
      <div className="app-grid-mask absolute inset-0 opacity-[0.4] dark:opacity-[0.28]" />
      <div className="absolute -top-48 left-1/2 h-[42rem] w-[min(90rem,200vw)] -translate-x-1/2 rounded-full bg-gradient-to-b from-indigo-400/30 via-violet-400/12 to-transparent blur-3xl dark:from-indigo-500/20 dark:via-violet-600/10" />
      <div className="absolute -right-24 bottom-0 h-[32rem] w-[min(56rem,120vw)] rounded-full bg-gradient-to-tl from-cyan-400/18 via-transparent to-transparent blur-3xl dark:from-cyan-500/12" />
      <div className="absolute bottom-1/4 left-0 h-72 w-72 -translate-x-1/3 rounded-full bg-fuchsia-400/12 blur-3xl dark:bg-fuchsia-500/8" />
      <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-violet-400/10 blur-3xl dark:bg-violet-500/8" />
    </div>
  );
}
