import { Request, Response } from "express";
import * as campaignService from "../services/campaignService.js";
import * as contributionService from "../services/contributionService.js";
import * as reportService from "../services/reportService.js";
import { validateCreateCampaignBody } from "../validation/campaignValidation.js";
import { validatePatchStatusBody } from "../validation/contributionValidation.js";
import { cacheGetOrSet } from "../cache/cache.js";
import { bumpCampaignsCacheVersion, getCampaignsCacheVersion } from "../cache/versions.js";

function ttlSeconds(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (!raw) return fallback;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function createCampaign(req: Request, res: Response) {
  try {
    const validation = validateCreateCampaignBody(req.body);
    if (!validation.valid) {
      return res.status(validation.statusCode).json({ error: validation.error });
    }
    const { data } = validation;

    const campaign = await campaignService.create({
      title: data.title,
      description: data.description,
      goal: data.goal,
      deadline: data.deadline,
      creator: data.creator,
      campaignAddress: data.campaignAddress,
      txHash: data.txHash,
    });
    await bumpCampaignsCacheVersion();
    return res.status(201).json(formatCampaign(campaign));
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { code?: string };
    if (e.code === "DUPLICATE_CAMPAIGN") {
      return res.status(409).json({ error: e.message });
    }
    if (e.code === "23505") {
      return res.status(409).json({ error: "A campaign with this contract address is already registered" });
    }
    return res.status(400).json({ error: e.message || "Bad request" });
  }
}

export async function getCampaigns(_req: Request, res: Response) {
  try {
    const v = await getCampaignsCacheVersion();
    const ttl = ttlSeconds("CACHE_TTL_CAMPAIGNS_LIST_SECONDS", 30);
    const payload = await cacheGetOrSet(`campaigns:list:v${v}`, ttl, async () => {
      const campaigns = await campaignService.findAll();
      return campaigns.map(formatCampaign);
    });
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function searchCampaigns(req: Request, res: Response) {
  try {
    const {
      q,
      status,
      goalMin,
      goalMax,
      deadline,
      page = "1",
      pageSize = "12",
    } = req.query as Record<string, string | undefined>;

    const parsedPage = Number.parseInt(page ?? "1", 10);
    const parsedPageSize = Number.parseInt(pageSize ?? "12", 10);

    let deadlineBefore: Date | undefined;
    if (deadline) {
      const d = new Date(deadline);
      if (!Number.isNaN(d.getTime())) {
        deadlineBefore = d;
      }
    }

    const opts: campaignService.SearchCampaignsOptions = {
      q: q?.trim() || undefined,
      status: status?.trim()
        ? status.trim().charAt(0).toUpperCase() + status.trim().slice(1).toLowerCase()
        : undefined,
      goalMinWei: goalMin && /^\d+$/.test(goalMin) ? goalMin : undefined,
      goalMaxWei: goalMax && /^\d+$/.test(goalMax) ? goalMax : undefined,
      deadlineBefore,
      page: Number.isNaN(parsedPage) ? 1 : parsedPage,
      pageSize: Number.isNaN(parsedPageSize) ? 12 : parsedPageSize,
    };
    const v = await getCampaignsCacheVersion();
    const ttl = ttlSeconds("CACHE_TTL_CAMPAIGNS_SEARCH_SECONDS", 20);
    const key = `campaigns:search:v${v}:${JSON.stringify({
      q: opts.q ?? null,
      status: opts.status ?? null,
      goalMinWei: opts.goalMinWei ?? null,
      goalMaxWei: opts.goalMaxWei ?? null,
      deadlineBefore: opts.deadlineBefore ? opts.deadlineBefore.toISOString() : null,
      page: opts.page,
      pageSize: opts.pageSize,
    })}`;
    const payload = await cacheGetOrSet(key, ttl, async () => {
      const result = await campaignService.searchCampaigns(opts);
      return {
        items: result.items.map(formatCampaign),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      };
    });
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getActiveCampaigns(req: Request, res: Response) {
  return searchCampaigns(
    { ...req, query: { ...req.query, status: "active" } } as unknown as Request,
    res
  );
}

export async function getSuccessfulCampaigns(req: Request, res: Response) {
  return searchCampaigns(
    { ...req, query: { ...req.query, status: "successful" } } as unknown as Request,
    res
  );
}

export async function getCampaign(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId) || numId < 1) {
      return res.status(400).json({ error: "Invalid campaign id" });
    }
    const v = await getCampaignsCacheVersion();
    const ttl = ttlSeconds("CACHE_TTL_CAMPAIGN_DETAIL_SECONDS", 20);
    const payload = await cacheGetOrSet(`campaigns:detail:v${v}:id:${numId}`, ttl, async () => {
      const campaign = await campaignService.findById(String(numId));
      if (!campaign) return null;
      const contributors = await contributionService.findByCampaignId(numId);
      const reportCount = await reportService.getReportCountByCampaignId(numId);
      const addressesByChain = await campaignService.getAddressesByChain(numId);
      const totalRaisedAllChains = await campaignService.getTotalRaisedAllChains(numId);
      const base = formatCampaign(campaign);
      const { trustScore: creatorTrustScore } = await campaignService.getCreatorTrustScore(campaign.creator);
      const addressesByChainRes =
        addressesByChain.length > 0
          ? addressesByChain
          : [{ chainId: 1, campaignAddress: campaign.campaign_address }];
      return {
        ...base,
        totalRaisedAllChains,
        addressesByChain: addressesByChainRes,
        creatorTrustScore,
        reportCount,
        contributors: contributors.map((c) => ({
          id: c.id,
          contributorAddress: c.contributor_address,
          amountWei: c.amount_wei,
          txHash: c.tx_hash,
          chainId: c.chain_id,
          createdAt: c.created_at,
        })),
      };
    });
    if (!payload) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function patchCampaignStatus(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId) || numId < 1) {
      return res.status(400).json({ error: "Invalid campaign id" });
    }
    const validation = validatePatchStatusBody(req.body);
    if (!validation.valid) {
      return res.status(validation.statusCode).json({ error: validation.error });
    }
    const campaign = await campaignService.findById(String(numId));
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    await campaignService.updateTotalRaisedAndStatus(numId, campaign.total_raised ?? "0", validation.status);
    await bumpCampaignsCacheVersion();
    const updated = await campaignService.findById(String(numId));
    return res.json(formatCampaign(updated!));
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

function formatCampaign(row: campaignService.CampaignRow) {
  /** API contract: camelCase; dates serialized as ISO by res.json(); wei as string. */
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    goal: row.goal,
    deadline: row.deadline,
    creator: row.creator,
    campaignAddress: row.campaign_address,
    txHash: row.tx_hash,
    totalRaised: row.total_raised ?? "0",
    status: row.status ?? "Active",
    isVerified: row.is_verified ?? false,
    category: row.category ?? null,
    createdAt: row.created_at,
  };
}
