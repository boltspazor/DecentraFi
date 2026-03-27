import { useState } from "react";
import { Link } from "react-router-dom";
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
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/75">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="shrink-0 text-lg font-bold tracking-tight sm:text-xl"
          onClick={() => setOpen(false)}
        >
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            DecentraFI
          </span>
        </Link>

        <div className="hidden items-center gap-0.5 md:flex lg:gap-1">
          {NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="hidden min-w-0 shrink md:block md:max-w-[min(100%,20rem)] lg:max-w-none">
          <WalletConnectButton />
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 md:hidden"
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
      </nav>

      {open && (
        <div className="animate-fade-in border-t border-slate-200 bg-white md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-0.5 px-4 py-3 sm:px-6">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="rounded-xl px-3 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 active:bg-slate-100"
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
            <div className="mt-2 border-t border-slate-100 pt-4">
              <WalletConnectButton />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
