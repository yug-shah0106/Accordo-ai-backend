import { Router } from 'express';
import {
  createProduct,
  getAllProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getAllProduct,
} from './product.controller.js';
import { authMiddleware, checkPermission } from '../../middlewares/auth.middleware.js';

const productRouter = Router();
const moduleId = 4;

productRouter.post(
  '/create',
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 3),
  createProduct
);

productRouter.get(
  '/get-all',
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 1),
  getAllProducts
);

productRouter.get(
  '/get/:productid',
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 1),
  getProduct
);

productRouter.get(
  '/getall',
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 1),
  getAllProduct
);

productRouter.put(
  '/update/:productid',
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 2),
  updateProduct
);

productRouter.delete(
  '/delete/:productid',
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 3),
  deleteProduct
);

export default productRouter;
