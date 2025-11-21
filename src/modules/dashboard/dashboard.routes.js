import { Router } from "express";
import { getDashboardData } from "./dashboard.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const dashboardRouter = Router();

dashboardRouter.get("/get", authMiddleware, getDashboardData);

export default dashboardRouter;
