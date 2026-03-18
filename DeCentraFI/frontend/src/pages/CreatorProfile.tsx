import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getCreatorHistory, getCreatorProfile } from "../services/api";

function shortAddr(a: string) {
  return a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function CreatorProfile() {
  const { wallet = "" } = useParams();
  const normalized = useMemo(() => wallet.trim(), [wallet]);

  const profileQ = useQuery({
    queryKey: ["creatorProfile", normalized],
    queryFn: () => getCreatorProfile(normalized),
    enabled: Boolean(normalized),
  });

  const historyQ = useQuery({
    queryKey: ["creatorHistory", normalized],
    queryFn: () => getCreatorHistory(normalized),
    enabled: Boolean(normalized),
  });

  if (!normalized) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold">Creator profile</h1>
        <p className="mt-2 text-gray-600">No wallet provided.</p>
      </div>
    );
  }

  if (profileQ.isLoading || historyQ.isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold">Creator profile</h1>
        <p className="mt-2 text-gray-600">Loading…</p>
      </div>
    );
  }

  if (profileQ.error) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold">Creator profile</h1>
        <p className="mt-2 text-red-600">Failed to load profile.</p>
      </div>
    );
  }

  const p = profileQ.data!;
  const campaigns = historyQ.data?.campaigns ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="rounded-xl border bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {p.ensName ? p.ensName : shortAddr(p.wallet)}
            </h1>
            <div className="mt-1 text-sm text-gray-600 break-all">{p.wallet}</div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {p.isVerified ? (
                <span className="px-2 py-1 rounded-full bg-green-100 text-green-800">
                  Verified identity
                </span>
              ) : (
                <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                  Unverified
                </span>
              )}
              <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                Trust score: {p.trustScore}/10
              </span>
              <span className="px-2 py-1 rounded-full bg-purple-50 text-purple-700">
                Successful: {p.successfulCampaigns}
              </span>
              <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700">
                Failed: {p.failedCampaigns}
              </span>
            </div>
          </div>

          <div className="text-sm text-gray-700 space-y-2 min-w-[220px]">
            <div>
              <div className="font-semibold text-gray-900">DID references</div>
              <div className="mt-1 space-y-1">
                <div>
                  <span className="text-gray-500">ENS:</span>{" "}
                  {p.ensName ? p.ensName : <span className="text-gray-400">—</span>}
                </div>
                <div>
                  <span className="text-gray-500">Lens:</span>{" "}
                  {p.lensHandle ? p.lensHandle : <span className="text-gray-400">—</span>}
                </div>
                <div className="break-all">
                  <span className="text-gray-500">Ceramic:</span>{" "}
                  {p.ceramicDid ? p.ceramicDid : <span className="text-gray-400">—</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">Campaign history</h2>
        {historyQ.error ? (
          <p className="mt-2 text-red-600">Failed to load history.</p>
        ) : campaigns.length === 0 ? (
          <p className="mt-2 text-gray-600">No campaigns found for this creator.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-600">
                <tr>
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Verified</th>
                  <th className="py-2 pr-4">Raised (wei)</th>
                  <th className="py-2 pr-4">Goal (wei)</th>
                  <th className="py-2 pr-4">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="py-2 pr-4">
                      <Link className="text-blue-600 hover:underline" to={`/campaigns/${c.id}`}>
                        {c.title}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{c.status}</td>
                    <td className="py-2 pr-4">{c.isVerified ? "Yes" : "No"}</td>
                    <td className="py-2 pr-4">{c.totalRaised}</td>
                    <td className="py-2 pr-4">{c.goal}</td>
                    <td className="py-2 pr-4">
                      {new Date(c.deadline).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

