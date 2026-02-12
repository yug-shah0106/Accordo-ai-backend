import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Request } from 'express';

const uploadPath = path.resolve(process.cwd(), 'uploads');

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadPath);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg'];
const documentExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg'];

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (!imageExtensions.includes(path.extname(file.originalname).toLowerCase())) {
    cb(new Error('You can upload only image!'));
  } else {
    cb(null, true);
  }
};

// File filter for documents (images + PDF)
const documentFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (!documentExtensions.includes(path.extname(file.originalname).toLowerCase())) {
    cb(new Error('You can upload only images or PDF files!'));
  } else {
    cb(null, true);
  }
};

export const upload = multer({ storage, fileFilter });
export const uploadDocument = multer({ storage, fileFilter: documentFileFilter });
