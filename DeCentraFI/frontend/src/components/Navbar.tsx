import { useState } from "react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { WalletConnectButton } from "./WalletConnectButton";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Explore" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/create", label: "Create" },
  { to: "/admin", label: "Admin" },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 dark:border-slate-800/80 dark:bg-slate-950/75 dark:supports-[backdrop-filter]:bg-slate-950/65">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="shrink-0 text-lg font-bold tracking-tight sm:text-xl"
          onClick={() => setOpen(false)}
        >
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-cyan-400">
            DecentraFI
          </span>
        </Link>

        <div className="hidden items-center gap-0.5 md:flex lg:gap-1">
          {NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white"
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex md:min-w-0 md:shrink">
          <ThemeToggle />
          <div className="min-w-0 md:max-w-[min(100%,20rem)] lg:max-w-none">
            <WalletConnectButton />
          </div>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div className="animate-fade-in border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95 md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-0.5 px-4 py-3 sm:px-6">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="rounded-xl px-3 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 active:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/80 dark:active:bg-slate-800"
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
            <div className="mt-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <WalletConnectButton />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
