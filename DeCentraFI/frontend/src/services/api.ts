import { API_BASE } from "../config/apiBase";

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
  isVerified?: boolean;
  category?: string | null;
  createdAt: string;
}

/** Campaign deployment address per chain for multi-chain contributions. */
export interface CampaignChainAddress {
  chainId: number;
  campaignAddress: string;
}

/** GET /campaigns/:id response: campaign + optional contributors + creator trust score + reportCount + multi-chain. */
export interface GetCampaignResponse extends CampaignMeta {
  contributors?: ContributionMeta[];
  /** Creator trust score 0–10 from successful/failed campaign history. */
  creatorTrustScore?: number;
  /** Number of reports submitted for this campaign. */
  reportCount?: number;
  /** Total raised across all chains (wei string). */
  totalRaisedAllChains?: string;
  /** Campaign contract address per chain. */
  addressesByChain?: CampaignChainAddress[];
}

export interface ReportItem {
  id: number;
  campaignId: number;
  reporterWallet: string;
  reason: string | null;
  createdAt: string;
}

export interface ReportedCampaignItem {
  id: number;
  title: string;
  campaignAddress: string;
  isVerified: boolean;
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

export interface CampaignAnalytics {
  campaignId: number;
  totalContributionsWei: string;
  uniqueContributors: number;
  averageContributionWei: string;
  fundingSpeedWeiPerHour: string;
  goalCompletionPercentage: number;
  timeseries: {
    timestamp: string;
    cumulativeWei: string;
    contributionCount: number;
  }[];
}

export interface GlobalAnalytics {
  totalContributionsWei: string;
  uniqueContributors: number;
  totalCampaigns: number;
  averageContributionWei: string;
}

export interface CreatorProfile {
  wallet: string;
  ensName: string | null;
  lensHandle: string | null;
  ceramicDid: string | null;
  isVerified: boolean;
  trustScore: number;
  successfulCampaigns: number;
  failedCampaigns: number;
}

export interface CreatorHistoryItem {
  id: number;
  title: string;
  status: string;
  totalRaised: string;
  goal: string;
  deadline: string;
  createdAt: string;
  campaignAddress: string;
  isVerified: boolean;
}

export async function getCreatorProfile(wallet: string): Promise<CreatorProfile> {
  const res = await fetch(`${API_BASE}/api/creators/${wallet}`);
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(text || "Failed to load creator profile", res.status);
  }
  return (await res.json()) as CreatorProfile;
}

export async function getCreatorHistory(wallet: string): Promise<{ wallet: string; campaigns: CreatorHistoryItem[] }> {
  const res = await fetch(`${API_BASE}/api/creators/${wallet}/history`);
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(text || "Failed to load creator history", res.status);
  }
  return (await res.json()) as { wallet: string; campaigns: CreatorHistoryItem[] };
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

export async function getRecommendations(walletAddress: string, limit = 12): Promise<CampaignMeta[]> {
  const res = await fetch(`${API_BASE}/api/recommendations/${encodeURIComponent(walletAddress)}?limit=${limit}`);
  if (!res.ok) {
    if (res.status === 400) return [];
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

export async function getCampaignAnalytics(id: number): Promise<CampaignAnalytics> {
  const res = await fetch(`${API_BASE}/api/analytics/campaign/${id}`);
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

export async function getGlobalAnalytics(): Promise<GlobalAnalytics> {
  const res = await fetch(`${API_BASE}/api/analytics/global`);
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

export async function reportCampaign(data: {
  campaignId: number;
  reporterWallet: string;
  reason?: string;
}): Promise<ReportItem> {
  const res = await fetch(`${API_BASE}/api/campaigns/report`, {
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

export async function getReportsByCampaignId(campaignId: number): Promise<ReportItem[]> {
  const res = await fetch(`${API_BASE}/api/campaigns/reports/${campaignId}`);
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

export async function verifyCampaign(
  campaignId: number,
  adminWallet: string
): Promise<{ id: number; isVerified: boolean; title: string }> {
  const res = await fetch(`${API_BASE}/api/campaigns/${campaignId}/verify`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Wallet": adminWallet },
    body: JSON.stringify({ adminWallet }),
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

export async function getReportedCampaigns(): Promise<{
  campaigns: ReportedCampaignItem[];
}> {
  const res = await fetch(`${API_BASE}/api/campaigns/reported`);
  if (!res.ok) throw new ApiError("Failed to fetch reported campaigns", res.status);
  return res.json();
}

export interface ContributionMeta {
  id: number;
  campaignId: number;
  contributorAddress: string;
  amountWei: string;
  txHash: string;
  chainId?: number;
  createdAt: string;
}

export async function postContribution(data: {
  campaignId: number;
  contributorAddress: string;
  amountWei: string;
  txHash: string;
  chainId: number;
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

export interface UserNft {
  tokenId: number;
  campaignId: number;
  contributorWallet: string;
  nftLevel: string;
  ipfsHash: string;
  createdAt: string;
}

export async function getUserNfts(walletAddress: string): Promise<UserNft[]> {
  const res = await fetch(`${API_BASE}/api/user/nfts/${walletAddress}`);
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
