import { Router } from "express";
import {
  createRole,
  getAllRoles,
  getRole,
  updateRole,
  deleteRole,
} from "./role.controller.js";
import { authMiddleware, checkPermission } from "../../middlewares/auth.middleware.js";

const roleRouter = Router();
const moduleId = 6;

roleRouter.post(
  "/create",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 3),
  createRole
);

roleRouter.get(
  "/get-all",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 1),
  getAllRoles
);

roleRouter.get(
  "/get/:roleid",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 1),
  getRole
);

roleRouter.put(
  "/update/:roleid",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 2),
  updateRole
);

roleRouter.delete(
  "/delete/:roleid",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 3),
  deleteRole
);

export default roleRouter;
