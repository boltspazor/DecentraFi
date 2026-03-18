import { Request, Response } from "express";
import * as qfService from "../services/qfService.js";

function parseMatchingPoolWei(req: Request): bigint {
  const raw = (req.query.matchingPoolWei as string | undefined)?.trim()
    ?? process.env.MATCHING_POOL_WEI?.trim()
    ?? "0";
  if (!/^\d+$/.test(raw)) return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

export async function getAllocations(req: Request, res: Response) {
  try {
    const matchingPoolWei = parseMatchingPoolWei(req);
    const data = await qfService.getQfAllocations(matchingPoolWei);
    return res.json(data);
  } catch {
    return res.status(500).json({ error: "Failed to compute QF allocations" });
  }
}

export async function getCampaignImpact(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: "Invalid campaign id" });
    }
    const matchingPoolWei = parseMatchingPoolWei(req);
    const data = await qfService.getQfImpactForCampaign(id, matchingPoolWei);
    return res.json(data);
  } catch {
    return res.status(500).json({ error: "Failed to compute QF impact" });
  }
}

