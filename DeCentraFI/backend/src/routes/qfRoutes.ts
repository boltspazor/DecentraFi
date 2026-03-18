import { Router } from "express";
import * as qfController from "../controllers/qfController.js";

const router = Router();

// GET /api/qf/allocations?matchingPoolWei=...
router.get("/allocations", qfController.getAllocations);
// GET /api/qf/campaigns/:id?matchingPoolWei=...
router.get("/campaigns/:id", qfController.getCampaignImpact);

export default router;

