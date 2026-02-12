import { Router } from 'express';
import {
  createCompany,
  updateCompany,
  getCompany,
  getAllCompany,
  deleteCompany,
} from './company.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/upload.middleware.js';
import { cleanJson } from '../../middlewares/clean.middleware.js';

const companyRouter = Router();

companyRouter.post('/create', authMiddleware, upload.any(), cleanJson, createCompany);

companyRouter.put(
  '/update/:companyid',
  authMiddleware,
  upload.any(),
  cleanJson,
  updateCompany
);

companyRouter.get('/get-all', authMiddleware, getAllCompany);
companyRouter.get('/get/:companyid', authMiddleware, getCompany);
companyRouter.delete('/delete/:companyid', authMiddleware, deleteCompany);

export default companyRouter;
