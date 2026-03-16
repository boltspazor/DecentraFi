import { Request, Response } from "express";
import * as contributionService from "../services/contributionService.js";
import * as campaignService from "../services/campaignService.js";
import { validateContributionBody } from "../validation/contributionValidation.js";

export async function createContribution(req: Request, res: Response) {
  try {
    const validation = validateContributionBody(req.body);
    if (!validation.valid) {
      return res.status(validation.statusCode).json({ error: validation.error });
    }
    const { data } = validation;

    const existing = await contributionService.findByTxHashAndChain(data.txHash, data.chainId);
    if (existing) {
      return res.status(409).json({ error: "Contribution with this transaction hash already recorded on this chain" });
    }

    const campaign = await campaignService.findById(String(data.campaignId));
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const contribution = await contributionService.create({
      campaignId: data.campaignId,
      contributorAddress: data.contributorAddress,
      amountWei: data.amountWei,
      txHash: data.txHash,
      chainId: data.chainId,
    });

    const newTotal = BigInt(campaign.total_raised ?? "0") + BigInt(data.amountWei);
    const goalReached = newTotal >= BigInt(campaign.goal);
    await campaignService.updateTotalRaisedAndStatus(
      data.campaignId,
      String(newTotal),
      goalReached ? "Successful" : "Active"
    );

    return res.status(201).json({
      id: contribution.id,
      campaignId: contribution.campaign_id,
      contributorAddress: contribution.contributor_address,
      amountWei: contribution.amount_wei,
      txHash: contribution.tx_hash,
      chainId: contribution.chain_id,
      createdAt: contribution.created_at,
    });
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { code?: string };
    if (e.code === "23505") {
      return res.status(409).json({ error: "Contribution with this transaction hash already recorded" });
    }
    return res.status(400).json({ error: e.message || "Bad request" });
  }
}

export async function getContributionsByCampaign(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const campaignId = parseInt(id, 10);
    if (Number.isNaN(campaignId) || campaignId < 1) {
      return res.status(400).json({ error: "Invalid campaign id" });
    }
    const campaign = await campaignService.findById(String(campaignId));
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    const contributions = await contributionService.findByCampaignId(campaignId);
    return res.json(
      contributions.map((c) => ({
        id: c.id,
        campaignId: c.campaign_id,
        contributorAddress: c.contributor_address,
        amountWei: c.amount_wei,
        txHash: c.tx_hash,
        chainId: c.chain_id,
        createdAt: c.created_at,
      }))
    );
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
