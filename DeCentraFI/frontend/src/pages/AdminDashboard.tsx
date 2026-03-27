import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Link } from "react-router-dom";
import * as api from "../services/api";
import { PageShell } from "../components/PageShell";
import { btnPrimary, cardInteractive } from "../styles/ui";

const ADMIN_WALLET = (import.meta.env.VITE_ADMIN_WALLET as string)?.toLowerCase();

export function AdminDashboard() {
  const { address, isConnected } = useAccount();
  const [reported, setReported] = useState<api.ReportedCampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const isAdmin = isConnected && address && ADMIN_WALLET && address.toLowerCase() === ADMIN_WALLET;

  useEffect(() => {
    let cancelled = false;
    api
      .getReportedCampaigns()
      .then((res) => {
        if (!cancelled) setReported(res.campaigns);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleVerify = async (campaignId: number) => {
    if (!address || !ADMIN_WALLET || address.toLowerCase() !== ADMIN_WALLET) return;
    setVerifyingId(campaignId);
    setError(null);
    try {
      await api.verifyCampaign(campaignId, address);
      setReported((prev) =>
        prev.map((c) => (c.id === campaignId ? { ...c, isVerified: true } : c))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to verify");
    } finally {
      setVerifyingId(null);
    }
  };

  if (!isConnected || !address) {
    return (
      <PageShell maxWidth="narrow">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Admin</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">Connect your wallet to access the admin dashboard.</p>
      </PageShell>
    );
  }

  if (!ADMIN_WALLET || !isAdmin) {
    return (
      <PageShell maxWidth="narrow">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Admin</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">You do not have permission to view this page.</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="narrow">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Admin</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Review reported campaigns and verify them. Only the configured admin wallet can verify.
      </p>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-slate-500 dark:text-slate-400">Loading reported campaigns…</p>
      ) : reported.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-10 text-center text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
          No reported campaigns.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {reported.map((c) => (
            <li
              key={c.id}
              className={`${cardInteractive} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}
            >
              <div className="min-w-0">
                <Link
                  to={`/campaigns/${c.id}`}
                  className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {c.title}
                </Link>
                <p className="mt-1 break-all font-mono text-xs text-slate-500 dark:text-slate-400">{c.campaignAddress}</p>
                {c.isVerified && (
                  <span className="mt-2 inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    ✔ Verified
                  </span>
                )}
              </div>
              {!c.isVerified && (
                <button
                  type="button"
                  disabled={verifyingId === c.id}
                  onClick={() => handleVerify(c.id)}
                  className={`${btnPrimary} shrink-0 bg-emerald-600 hover:bg-emerald-700`}
                >
                  {verifyingId === c.id ? "Verifying…" : "Verify campaign"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
