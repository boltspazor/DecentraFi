import { Request, Response } from "express";
import * as creatorProfileService from "../services/creatorProfileService.js";
import * as campaignService from "../services/campaignService.js";

const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function normalizeOptionalString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function isValidEnsName(name: string): boolean {
  // Minimal sanity: allow typical ENS names, don’t enforce resolution here.
  if (name.length > 255) return false;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(name);
}

function isValidLensHandle(handle: string): boolean {
  if (handle.length > 255) return false;
  // lens handles often like "alice.lens" or "alice". Keep permissive.
  return /^[a-z0-9_.-]{1,255}$/i.test(handle);
}

function isValidCeramicDid(did: string): boolean {
  if (did.length > 255) return false;
  // Common forms: did:3:..., did:key:..., did:pkh:eip155:...
  return /^did:[a-z0-9]+:[A-Za-z0-9.\-_:]+$/.test(did);
}

function normalizeWallet(raw: string): string | null {
  const w = raw.trim();
  if (!ETH_ADDRESS_REGEX.test(w)) return null;
  return w.toLowerCase();
}

export async function getCreatorProfile(req: Request, res: Response) {
  try {
    const wallet = normalizeWallet(req.params.wallet ?? "");
    if (!wallet) return res.status(400).json({ error: "Valid wallet address (0x...) is required" });

    const profile = await creatorProfileService.getProfile(wallet);
    const trust = await campaignService.getCreatorTrustScore(wallet);

    return res.json({
      wallet,
      ensName: profile?.ens_name ?? null,
      lensHandle: profile?.lens_handle ?? null,
      ceramicDid: profile?.ceramic_did ?? null,
      isVerified: profile?.is_verified ?? false,
      updatedAt: profile?.updated_at ?? null,
      createdAt: profile?.created_at ?? null,
      trustScore: trust.trustScore,
      successfulCampaigns: trust.successfulCampaigns,
      failedCampaigns: trust.failedCampaigns,
    });
  } catch {
    return res.status(500).json({ error: "Failed to load creator profile" });
  }
}

export async function upsertCreatorProfile(req: Request, res: Response) {
  try {
    const wallet = normalizeWallet(req.params.wallet ?? "");
    if (!wallet) return res.status(400).json({ error: "Valid wallet address (0x...) is required" });

    const body = req.body as {
      ensName?: string | null;
      lensHandle?: string | null;
      ceramicDid?: string | null;
    };

    const ensName = normalizeOptionalString(body.ensName);
    const lensHandle = normalizeOptionalString(body.lensHandle);
    const ceramicDid = normalizeOptionalString(body.ceramicDid);

    if (ensName && !isValidEnsName(ensName)) {
      return res.status(400).json({ error: "Invalid ENS name format" });
    }
    if (lensHandle && !isValidLensHandle(lensHandle)) {
      return res.status(400).json({ error: "Invalid Lens handle format" });
    }
    if (ceramicDid && !isValidCeramicDid(ceramicDid)) {
      return res.status(400).json({ error: "Invalid Ceramic DID format" });
    }

    const row = await creatorProfileService.upsertProfile({
      wallet,
      ensName,
      lensHandle,
      ceramicDid,
    });

    return res.json({
      wallet: row.wallet,
      ensName: row.ens_name,
      lensHandle: row.lens_handle,
      ceramicDid: row.ceramic_did,
      isVerified: row.is_verified,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
    });
  } catch {
    return res.status(500).json({ error: "Failed to update creator profile" });
  }
}

export async function verifyCreator(req: Request, res: Response) {
  try {
    if (!ADMIN_WALLET) {
      return res.status(503).json({ error: "Admin verification not configured" });
    }
    const wallet = normalizeWallet(req.params.wallet ?? "");
    if (!wallet) return res.status(400).json({ error: "Valid wallet address (0x...) is required" });

    const adminWallet =
      (req.headers["x-admin-wallet"] as string)?.trim()?.toLowerCase() ||
      (req.body as { adminWallet?: string })?.adminWallet?.trim()?.toLowerCase();
    if (adminWallet !== ADMIN_WALLET) {
      return res.status(403).json({ error: "Forbidden: admin wallet required" });
    }

    await creatorProfileService.setVerified(wallet, true);
    return res.json({ wallet, isVerified: true });
  } catch {
    return res.status(500).json({ error: "Failed to verify creator" });
  }
}

export async function getCreatorHistory(req: Request, res: Response) {
  try {
    const wallet = normalizeWallet(req.params.wallet ?? "");
    if (!wallet) return res.status(400).json({ error: "Valid wallet address (0x...) is required" });

    // Simple history: campaigns created by this wallet (metadata is off-chain, but creator field is wallet)
    const result = await campaignService.searchCampaigns({
      q: wallet,
      page: 1,
      pageSize: 50,
    });
    // searchCampaigns matches creator ILIKE with q, but could include description/title hits;
    // so filter explicitly by creator.
    const items = result.items.filter((c) => (c.creator ?? "").toLowerCase() === wallet);

    return res.json({
      wallet,
      campaigns: items.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status ?? "Active",
        totalRaised: c.total_raised ?? "0",
        goal: c.goal,
        deadline: c.deadline,
        createdAt: c.created_at,
        campaignAddress: c.campaign_address,
        isVerified: c.is_verified ?? false,
      })),
    });
  } catch {
    return res.status(500).json({ error: "Failed to load creator history" });
  }
}

