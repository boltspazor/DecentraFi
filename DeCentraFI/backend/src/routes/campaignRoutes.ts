import { Router } from 'express'
import * as campaignController from '../controllers/campaignController.js'

const router = Router()

router.post('/', campaignController.createCampaign)
router.get('/', campaignController.getCampaigns)
router.get('/:id', campaignController.getCampaign)

export default router
