import { Router } from "express";
import {
  createRequisition,
  getRequisition,
  getAllRequisition,
  updateRequisition,
  deleteRequisition,
} from "./requisition.controller.js";
import { authMiddleware, checkPermission } from "../../middlewares/auth.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";
import { cleanJson } from "../../middlewares/clean.middleware.js";

const requisitionRouter = Router();
const moduleId = 3;

requisitionRouter.post(
  "/create",
  authMiddleware,
  upload.array("files", 10),
  cleanJson,
  (req, res, next) => checkPermission(req, res, next, moduleId, 3),
  createRequisition
);

requisitionRouter.get(
  "/get/:requisitionid",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 1),
  getRequisition
);

requisitionRouter.get(
  "/get-all",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 1),
  getAllRequisition
);

requisitionRouter.put(
  "/update/:requisitionid",
  authMiddleware,
  upload.array("files", 10),
  cleanJson,
  (req, res, next) => checkPermission(req, res, next, moduleId, 2),
  updateRequisition
);

requisitionRouter.delete(
  "/delete/:requisitionid",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 3),
  deleteRequisition
);

export default requisitionRouter;
