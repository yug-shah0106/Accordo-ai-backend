import { Router } from 'express';
import {
  createBenchmark,
  createFinalBenchmarkResult,
} from './benchmark.controller.js';
import {
  authMiddleware,
  checkPermission,
} from '../../middlewares/auth.middleware.js';

const benchmarkRouter = Router();
const moduleId = 3;

benchmarkRouter.post(
  '/create',
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 2),
  createBenchmark
);

benchmarkRouter.post(
  '/create-final-result',
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 2),
  createFinalBenchmarkResult
);

export default benchmarkRouter;
