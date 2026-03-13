import { Request, Response } from "express";
import * as contributionService from "../services/contributionService.js";

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export async function getUserContributions(req: Request, res: Response) {
  try {
    const wallet = req.params.wallet;
    if (typeof wallet !== "string" || !ETH_ADDRESS_REGEX.test(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }
    const rows = await contributionService.findUserContributions(wallet);
    return res.json(
      rows.map((r) => ({
        campaignId: r.campaign_id,
        title: r.title,
        status: r.status ?? "Active",
        campaignAddress: r.campaign_address,
        amountWei: r.amount_wei,
        createdAt: r.created_at,
      }))
    );
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

