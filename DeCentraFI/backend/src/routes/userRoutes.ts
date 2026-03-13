import { Router } from "express";
import * as userController from "../controllers/userController.js";

const router = Router();

router.get("/contributions/:wallet", userController.getUserContributions);

export default router;

