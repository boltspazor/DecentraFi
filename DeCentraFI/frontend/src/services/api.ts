const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface CampaignMeta {
  id: number;
  title: string;
  description: string;
  goal: string;
  deadline: string;
  creator: string;
  campaignAddress: string;
  txHash: string | null;
  totalRaised?: string;
  status?: string;
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
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      // use raw text
    }
    throw new ApiError(message, res.status, text);
  }
  return res.json() as Promise<CampaignMeta>;
}

export async function getCampaigns(): Promise<CampaignMeta[]> {
  const res = await fetch(`${API_BASE}/api/campaigns`);
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      //
    }
    throw new ApiError(message, res.status);
  }
  return res.json();
}

export async function getCampaign(id: string): Promise<CampaignMeta> {
  const res = await fetch(`${API_BASE}/api/campaigns/${id}`);
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      //
    }
    throw new ApiError(message, res.status);
  }
  return res.json();
}

export interface ContributionMeta {
  id: number;
  campaignId: number;
  contributorAddress: string;
  amountWei: string;
  txHash: string;
  createdAt: string;
}

export async function postContribution(data: {
  campaignId: number;
  contributorAddress: string;
  amountWei: string;
  txHash: string;
}): Promise<ContributionMeta> {
  const res = await fetch(`${API_BASE}/api/contributions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      //
    }
    throw new ApiError(message, res.status);
  }
  return res.json();
}

export async function getContributionsByCampaign(campaignId: number): Promise<ContributionMeta[]> {
  const res = await fetch(`${API_BASE}/api/contributions/campaign/${campaignId}`);
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      //
    }
    throw new ApiError(message, res.status);
  }
  return res.json();
}

export async function patchCampaignStatus(campaignId: number, status: string): Promise<CampaignMeta> {
  const res = await fetch(`${API_BASE}/api/campaigns/${campaignId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      //
    }
    throw new ApiError(message, res.status);
  }
  return res.json();
}
