import { User } from '../models/user.js';

declare global {
  namespace Express {
    interface Request {
      context: {
        userId: number;
        userType: string;
        companyId?: number;
        email?: string;
      };
      user?: User;
      files?: Express.Multer.File[];
    }
  }
}

export {};
