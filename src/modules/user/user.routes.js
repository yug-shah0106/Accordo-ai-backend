import { Router } from "express";
import {
  getUserProfileController,
  createUser,
  assignRole,
  getUserRolePermission,
  updateProfile,
  getAllUsers,
  getUser,
} from "./user.controller.js";
import { authMiddleware, checkPermission } from "../../middlewares/auth.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";
import { cleanJson } from "../../middlewares/clean.middleware.js";

const userRouter = Router();
const moduleId = 2;

userRouter.get("/profile", authMiddleware, getUserProfileController);

userRouter.post(
  "/create",
  authMiddleware,
  upload.any(),
  cleanJson,
  (req, res, next) => checkPermission(req, res, next, moduleId, 3),
  createUser
);

userRouter.post(
  "/update-profile",
  authMiddleware,
  upload.any(),
  cleanJson,
  (req, res, next) => checkPermission(req, res, next, moduleId, 2),
  updateProfile
);

userRouter.get(
  "/get/:userid",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 1),
  getUser
);

userRouter.get(
  "/get-all",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 1),
  getAllUsers
);

userRouter.post(
  "/assign-role",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 2),
  assignRole
);

userRouter.get(
  "/user-role-permission/:userid",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 1),
  getUserRolePermission
);

export default userRouter;
