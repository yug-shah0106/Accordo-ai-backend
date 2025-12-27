import { Router } from "express";
import * as controller from "./negotiation.controller.js";
// import { verifyToken } from "../../middlewares/auth.js"; // Uncomment when ready

const router = Router();

router.post("/start", controller.startNegotiation);
router.get("/:id", controller.getNegotiationDetails);
router.post("/preferences", controller.setPreferences);
router.get("/:id/analysis", controller.getAnalysis);
router.post("/:id/next-move", controller.getNextMove);

export default router;
