import { Router } from 'express';
import { extractDocument, extractDocumentBatch } from './document.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { uploadDocument } from '../../middlewares/upload.middleware.js';
import { cleanJson } from '../../middlewares/clean.middleware.js';

const documentRouter = Router();

/**
 * Extract document number from uploaded file
 * POST /api/document/extract
 * Body: { documentType: 'GST' | 'PAN' | 'MSME' | 'CI' }
 * File: single file upload
 */
documentRouter.post(
  '/extract',
  authMiddleware,
  uploadDocument.any(),
  cleanJson,
  extractDocument
);

/**
 * Extract multiple document numbers from uploaded files
 * POST /api/document/extract-batch
 * Body: { documents: [{ fieldName: string, documentType: 'GST' | 'PAN' | 'MSME' | 'CI' }] }
 * Files: multiple file uploads
 */
documentRouter.post(
  '/extract-batch',
  authMiddleware,
  uploadDocument.any(),
  cleanJson,
  extractDocumentBatch
);

export default documentRouter;
