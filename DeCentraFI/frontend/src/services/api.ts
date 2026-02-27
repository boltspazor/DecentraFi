const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export interface CampaignMeta {
  id: number;
  title: string;
  description: string;
  goal: string;
  deadline: string;
  creator: string;
  campaignAddress: string;
  txHash: string | null;
  createdAt: string;
}

export async function createCampaign(data: {
  title: string;
  description: string;
  goal: string;
  deadline: string;
  creator: string;
  campaignAddress: string;
  txHash?: string;
}) {
  const res = await fetch(`${API_BASE}/api/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<CampaignMeta>;
}

export async function getCampaigns(): Promise<CampaignMeta[]> {
  const res = await fetch(`${API_BASE}/api/campaigns`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getCampaign(id: string): Promise<CampaignMeta> {
  const res = await fetch(`${API_BASE}/api/campaigns/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
