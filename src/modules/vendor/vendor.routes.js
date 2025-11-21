import { Router } from "express";
import {
  createVendor,
  getAllVendors,
  getVendor,
  updateVendor,
  deleteVendor,
} from "./vendor.controller.js";
import { authMiddleware, checkPermission } from "../../middlewares/auth.middleware.js";

const vendorRouter = Router();
const moduleId = 5;

vendorRouter.post(
  "/create",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 3),
  createVendor
);

vendorRouter.get(
  "/get-all",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 1),
  getAllVendors
);

vendorRouter.get(
  "/get/:vendorid",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 1),
  getVendor
);

vendorRouter.put(
  "/update/:vendorid",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 2),
  updateVendor
);

vendorRouter.delete(
  "/delete/:vendorid",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 3),
  deleteVendor
);

export default vendorRouter;
