import { Request, Response } from "express";
import * as recommendationService from "../services/recommendationService.js";

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export async function getRecommendations(req: Request, res: Response) {
  try {
    const wallet = (req.params.wallet ?? "").trim();
    if (!ETH_ADDRESS_REGEX.test(wallet)) {
      return res.status(400).json({ error: "Valid wallet address (0x...) is required" });
    }
    const limit = Math.min(Math.max(1, parseInt(String(req.query.limit), 10) || 12), 24);
    const campaigns = await recommendationService.getRecommendationsForWallet(wallet, limit);
    return res.json(
      campaigns.map((row) => ({
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
      }))
    );
  } catch (err) {
    return res.status(500).json({ error: "Failed to load recommendations" });
  }
}
