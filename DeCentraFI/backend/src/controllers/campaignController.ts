import { Request, Response } from 'express'
import * as campaignService from '../services/campaignService'

export async function createCampaign(req: Request, res: Response) {
  try {
    const campaign = await campaignService.create(req.body)
    res.status(201).json(campaign)
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
}

export async function getCampaigns(_req: Request, res: Response) {
  try {
    const campaigns = await campaignService.findAll()
    res.json(campaigns)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function getCampaign(req: Request, res: Response) {
  try {
    const campaign = await campaignService.findById(req.params.id)
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
    res.json(campaign)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
}
