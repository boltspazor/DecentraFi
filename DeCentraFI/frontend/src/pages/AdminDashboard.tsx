import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Link } from "react-router-dom";
import * as api from "../services/api";

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
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Admin Dashboard</h1>
        <p className="text-gray-600">Connect your wallet to access the admin dashboard.</p>
      </div>
    );
  }

  if (!ADMIN_WALLET || !isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Admin Dashboard</h1>
        <p className="text-gray-600">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Admin Dashboard</h1>
      <p className="text-gray-600 mb-6">
        View reported campaigns and verify them. Only the configured admin wallet can verify.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading reported campaigns…</p>
      ) : reported.length === 0 ? (
        <p className="text-gray-500">No reported campaigns.</p>
      ) : (
        <ul className="space-y-3">
          {reported.map((c) => (
            <li
              key={c.id}
              className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm flex flex-wrap items-center justify-between gap-2"
            >
              <div>
                <Link
                  to={`/campaigns/${c.id}`}
                  className="font-semibold text-indigo-600 hover:underline"
                >
                  {c.title}
                </Link>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{c.campaignAddress}</p>
                {c.isVerified && (
                  <span className="inline-block mt-1 text-xs font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                    ✔ Verified
                  </span>
                )}
              </div>
              {!c.isVerified && (
                <button
                  type="button"
                  disabled={verifyingId === c.id}
                  onClick={() => handleVerify(c.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                >
                  {verifyingId === c.id ? "Verifying…" : "Verify Campaign"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
