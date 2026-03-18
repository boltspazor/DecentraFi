import { Router } from "express";
import * as creatorController from "../controllers/creatorController.js";

const router = Router();

router.get("/:wallet", creatorController.getCreatorProfile);
router.put("/:wallet", creatorController.upsertCreatorProfile);
router.patch("/:wallet/verify", creatorController.verifyCreator);
router.get("/:wallet/history", creatorController.getCreatorHistory);

export default router;

