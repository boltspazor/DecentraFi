import { Router } from 'express'
import * as campaignController from '../controllers/campaignController.js'
import * as moderationController from '../controllers/moderationController.js'

const router = Router()

router.post('/', campaignController.createCampaign)
router.get('/', campaignController.getCampaigns)
router.get('/search', campaignController.searchCampaigns)
router.get('/active', campaignController.getActiveCampaigns)
router.get('/successful', campaignController.getSuccessfulCampaigns)
router.post('/report', moderationController.postReport)
router.get('/reports/:campaignId', moderationController.getReportsByCampaignId)
router.get('/reported', moderationController.getReportedCampaigns)
router.get('/:id', campaignController.getCampaign)
router.patch('/:id/status', campaignController.patchCampaignStatus)
router.patch('/:id/verify', moderationController.patchVerify)

export default router
