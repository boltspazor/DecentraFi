import { Router } from "express";
import * as userController from "../controllers/userController.js";
import * as nftController from "../controllers/nftController.js";

const router = Router();

router.get("/contributions/:wallet", userController.getUserContributions);
router.get("/nfts/:wallet", nftController.getUserNfts);

export default router;

