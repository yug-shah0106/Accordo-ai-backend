import { Router } from "express";
import * as controller from "./chat.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();

// Health check endpoint (public for debugging)
router.get("/health", controller.checkLLMHealth);

// Test endpoint for database connectivity (protected)
router.get("/test-db", authMiddleware, controller.testDatabaseConnection);

// Chat endpoints (protected)
router.get("/sessions", authMiddleware, controller.getSessions);
router.get("/sessions/:sessionId", authMiddleware, controller.getSession);
router.post("/", authMiddleware, controller.sendMessage);
router.post("/stream", authMiddleware, controller.sendMessageStream);

export default router;
