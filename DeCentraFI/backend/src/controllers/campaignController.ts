import { Request, Response } from "express";
import * as campaignService from "../services/campaignService.js";
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
    return res.json(formatCampaign(campaign));
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
    createdAt: row.created_at,
  };
}
