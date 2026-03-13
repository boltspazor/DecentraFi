const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/** API contract: backend uses camelCase; goal/amountWei/totalRaised as wei strings; dates as ISO 8601. */
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

/** GET /campaigns/:id response: campaign + optional contributors (same shape as GET /contributions/campaign/:id). */
export interface GetCampaignResponse extends CampaignMeta {
  contributors?: ContributionMeta[];
}

export interface CampaignSearchParams {
  q?: string;
  status?: "Active" | "Successful" | "Failed";
  goalMinWei?: string;
  goalMaxWei?: string;
  deadlineBefore?: string;
  page?: number;
  pageSize?: number;
}

export interface CampaignSearchResult {
  items: CampaignMeta[];
  total: number;
  page: number;
  pageSize: number;
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

export async function searchCampaigns(params: CampaignSearchParams): Promise<CampaignSearchResult> {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.status) searchParams.set("status", params.status.toLowerCase());
  if (params.goalMinWei) searchParams.set("goalMin", params.goalMinWei);
  if (params.goalMaxWei) searchParams.set("goalMax", params.goalMaxWei);
  if (params.deadlineBefore) searchParams.set("deadline", params.deadlineBefore);
  if (params.page && params.page > 0) searchParams.set("page", String(params.page));
  if (params.pageSize && params.pageSize > 0) searchParams.set("pageSize", String(params.pageSize));

  const qs = searchParams.toString();
  const url = `${API_BASE}/api/campaigns/search${qs ? `?${qs}` : ""}`;
  const res = await fetch(url);
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

export async function getCampaign(id: string): Promise<GetCampaignResponse> {
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

export interface UserContributionSummary {
  campaignId: number;
  title: string;
  status: string;
  campaignAddress: string;
  amountWei: string;
  createdAt: string;
}

export async function getUserContributions(walletAddress: string): Promise<UserContributionSummary[]> {
  const res = await fetch(`${API_BASE}/api/user/contributions/${walletAddress}`);
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
