import type { Request, Response } from "express";
import * as nftService from "../services/nftService.js";

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export async function getUserNfts(req: Request, res: Response) {
  try {
    const wallet = req.params.wallet;
    if (typeof wallet !== "string" || !ETH_ADDRESS_REGEX.test(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }
    const rows = await nftService.findByWallet(wallet);
    return res.json(
      rows.map((r) => ({
        tokenId: Number(r.token_id),
        campaignId: r.campaign_id,
        contributorWallet: r.contributor_wallet,
        nftLevel: r.nft_level,
        ipfsHash: r.ipfs_hash,
        createdAt: r.created_at,
      }))
    );
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

