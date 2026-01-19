import { Router } from 'express';
import {
  createPo,
  getAllPo,
  getPo,
  cancelPo,
  downloadPo,
} from './po.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const poRouter = Router();

poRouter.post('/create', authMiddleware, createPo);
poRouter.get('/get-all', authMiddleware, getAllPo);
poRouter.get('/get/:poid', authMiddleware, getPo);
poRouter.put('/cancel/:poid', authMiddleware, cancelPo);
poRouter.get('/download/:poid', downloadPo);

export default poRouter;
