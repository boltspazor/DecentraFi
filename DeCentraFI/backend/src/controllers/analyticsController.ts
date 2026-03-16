import type { Request, Response } from "express";
import * as analyticsService from "../services/analyticsService.js";

export async function getCampaignAnalytics(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: "Invalid campaign id" });
    }
    const analytics = await analyticsService.getCampaignAnalytics(id);
    return res.json(analytics);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getGlobalAnalytics(_req: Request, res: Response) {
  try {
    const analytics = await analyticsService.getGlobalAnalytics();
    return res.json(analytics);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

