import { Router } from "express";
import * as contributionController from "../controllers/contributionController.js";

const router = Router();

router.post("/", contributionController.createContribution);
router.get("/campaign/:id", contributionController.getContributionsByCampaign);

export default router;
