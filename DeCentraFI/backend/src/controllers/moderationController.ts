import { Request, Response } from "express";
import * as campaignService from "../services/campaignService.js";
import * as reportService from "../services/reportService.js";
import { cacheGetOrSet } from "../cache/cache.js";
import { bumpCampaignsCacheVersion, getCampaignsCacheVersion } from "../cache/versions.js";

const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();

function ttlSeconds(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (!raw) return fallback;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** POST /api/campaigns/report — submit a report for a campaign */
export async function postReport(req: Request, res: Response) {
  try {
    const { campaignId, reporterWallet, reason } = req.body as {
      campaignId?: number;
      reporterWallet?: string;
      reason?: string;
    };
    if (campaignId == null || typeof campaignId !== "number" || campaignId < 1) {
      return res.status(400).json({ error: "Valid campaignId is required" });
    }
    if (!reporterWallet || typeof reporterWallet !== "string") {
      return res.status(400).json({ error: "reporterWallet is required" });
    }
    const campaign = await campaignService.findById(String(campaignId));
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    const report = await reportService.create({
      campaignId,
      reporterWallet: reporterWallet.trim(),
      reason: reason != null ? String(reason).trim() || undefined : undefined,
    });
    await bumpCampaignsCacheVersion();
    return res.status(201).json({
      id: report.id,
      campaignId: report.campaign_id,
      reporterWallet: report.reporter_wallet,
      reason: report.reason,
      createdAt: report.created_at,
    });
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { code?: string };
    if (e.code === "INVALID_WALLET") {
      return res.status(400).json({ error: e.message });
    }
    if (e.code === "DUPLICATE_REPORT") {
      return res.status(409).json({ error: e.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

/** GET /api/campaigns/reports/:campaignId — list reports for a campaign */
export async function getReportsByCampaignId(req: Request, res: Response) {
  try {
    const campaignId = parseInt(req.params.campaignId, 10);
    if (Number.isNaN(campaignId) || campaignId < 1) {
      return res.status(400).json({ error: "Invalid campaign id" });
    }
    const campaign = await campaignService.findById(String(campaignId));
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    const v = await getCampaignsCacheVersion();
    const ttl = ttlSeconds("CACHE_TTL_REPORTS_SECONDS", 30);
    const payload = await cacheGetOrSet(`campaigns:reports:v${v}:campaign:${campaignId}`, ttl, async () => {
      const reports = await reportService.findByCampaignId(campaignId);
      return reports.map((r) => ({
        id: r.id,
        campaignId: r.campaign_id,
        reporterWallet: r.reporter_wallet,
        reason: r.reason,
        createdAt: r.created_at,
      }));
    });
    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

/** PATCH /api/campaigns/:id/verify — set campaign as verified (admin only) */
export async function patchVerify(req: Request, res: Response) {
  try {
    if (!ADMIN_WALLET) {
      return res.status(503).json({ error: "Admin verification not configured" });
    }
    const adminWallet = (req.headers["x-admin-wallet"] as string)?.trim()?.toLowerCase()
      || (req.body as { adminWallet?: string })?.adminWallet?.trim()?.toLowerCase();
    if (adminWallet !== ADMIN_WALLET) {
      return res.status(403).json({ error: "Forbidden: admin wallet required" });
    }
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: "Invalid campaign id" });
    }
    const campaign = await campaignService.findById(String(id));
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    await campaignService.updateVerified(id, true);
    await bumpCampaignsCacheVersion();
    const updated = await campaignService.findById(String(id));
    return res.json({
      id: updated!.id,
      isVerified: true,
      title: updated!.title,
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

/** GET /api/campaigns/reported — list campaign ids that have reports (admin dashboard) */
export async function getReportedCampaigns(req: Request, res: Response) {
  try {
    const v = await getCampaignsCacheVersion();
    const ttl = ttlSeconds("CACHE_TTL_REPORTED_CAMPAIGNS_SECONDS", 30);
    const payload = await cacheGetOrSet(`campaigns:reported:v${v}`, ttl, async () => {
      const ids = await reportService.findCampaignIdsWithReports();
      const campaigns = await Promise.all(ids.map((id) => campaignService.findById(String(id))));
      const list = campaigns.filter(Boolean).map((c) => ({
        id: c!.id,
        title: c!.title,
        campaignAddress: c!.campaign_address,
        isVerified: c!.is_verified ?? false,
      }));
      return { campaigns: list };
    });
    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}
