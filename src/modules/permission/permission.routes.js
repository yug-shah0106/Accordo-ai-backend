import { Router } from "express";
import { getPermission } from "./permission.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const permissionRouter = Router();

permissionRouter.get("/get", authMiddleware, getPermission);

export default permissionRouter;
