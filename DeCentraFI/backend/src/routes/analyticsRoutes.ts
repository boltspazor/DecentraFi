import { Router } from "express";
import * as analyticsController from "../controllers/analyticsController.js";

const router = Router();

router.get("/campaign/:id", analyticsController.getCampaignAnalytics);
router.get("/global", analyticsController.getGlobalAnalytics);

export default router;

