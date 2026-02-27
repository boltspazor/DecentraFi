import { Request, Response } from "express";
import * as campaignService from "../services/campaignService.js";

export async function createCampaign(req: Request, res: Response) {
  try {
    const {
      title,
      description,
      goal,
      deadline,
      creator,
      campaignAddress,
      txHash,
    } = req.body;
    if (
      !title ||
      !description ||
      !goal ||
      !deadline ||
      !creator ||
      !campaignAddress
    ) {
      return res.status(400).json({
        error:
          "Missing required fields: title, description, goal, deadline, creator, campaignAddress",
      });
    }
    const campaign = await campaignService.create({
      title,
      description,
      goal,
      deadline,
      creator,
      campaignAddress,
      txHash,
    });
    res.status(201).json(formatCampaign(campaign));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function getCampaigns(_req: Request, res: Response) {
  try {
    const campaigns = await campaignService.findAll();
    res.json(campaigns.map(formatCampaign));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function getCampaign(req: Request, res: Response) {
  try {
    const campaign = await campaignService.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(formatCampaign(campaign));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
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
    createdAt: row.created_at,
  };
}
