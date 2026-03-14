import { Request, Response } from "express";
import * as campaignService from "../services/campaignService.js";
import * as contributionService from "../services/contributionService.js";
import * as reportService from "../services/reportService.js";
import { validateCreateCampaignBody } from "../validation/campaignValidation.js";
import { validatePatchStatusBody } from "../validation/contributionValidation.js";

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
    const campaigns = await campaignService.findAll();
    return res.json(campaigns.map(formatCampaign));
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

    const result = await campaignService.searchCampaigns(opts);
    return res.json({
      items: result.items.map(formatCampaign),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
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
    const campaign = await campaignService.findById(String(numId));
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    const contributors = await contributionService.findByCampaignId(numId);
    const reportCount = await reportService.getReportCountByCampaignId(numId);
    const payload = formatCampaign(campaign);
    const { trustScore: creatorTrustScore } = await campaignService.getCreatorTrustScore(campaign.creator);
    /** Response shape: campaign (camelCase, dates ISO) + contributors[] (camelCase) + creatorTrustScore + reportCount. */
    return res.json({
      ...payload,
      creatorTrustScore,
      reportCount,
      contributors: contributors.map((c) => ({
        id: c.id,
        contributorAddress: c.contributor_address,
        amountWei: c.amount_wei,
        txHash: c.tx_hash,
        createdAt: c.created_at,
      })),
    });
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
    createdAt: row.created_at,
  };
}
