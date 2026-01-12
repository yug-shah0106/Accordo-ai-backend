import { Router } from 'express';
import {
  createRequisition,
  getAllRequisitions,
  getRequisition,
  updateRequisition,
  deleteRequisition,
} from './requisition.controller.js';
import {
  authMiddleware,
  checkPermission,
} from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/upload.middleware.js';

const requisitionRouter = Router();
const moduleId = 3;

requisitionRouter.post(
  '/create',
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 3),
  upload.array('files', 10),
  createRequisition
);

requisitionRouter.get(
  '/get-all',
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 1),
  getAllRequisitions
);

requisitionRouter.get(
  '/get/:requisitionid',
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 1),
  getRequisition
);

requisitionRouter.put(
  '/update/:requisitionid',
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 2),
  upload.array('files', 10),
  updateRequisition
);

requisitionRouter.delete(
  '/delete/:requisitionid',
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 3),
  deleteRequisition
);

export default requisitionRouter;
