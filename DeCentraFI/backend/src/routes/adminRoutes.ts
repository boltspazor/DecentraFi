import { Router } from "express";
import * as adminController from "../controllers/adminController.js";

const router = Router();

router.get("/status", adminController.getAdminStatus);

export default router;
