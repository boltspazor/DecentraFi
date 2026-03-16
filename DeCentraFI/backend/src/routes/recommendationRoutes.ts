import { Router } from "express";
import * as recommendationController from "../controllers/recommendationController.js";

const router = Router();

router.get("/:wallet", recommendationController.getRecommendations);

export default router;
