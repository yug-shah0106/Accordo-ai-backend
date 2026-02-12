import { Request, Response, NextFunction } from 'express';

interface CleanableObject {
  [key: string]: unknown;
}

export const cleanJson = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const clean = (obj: CleanableObject): void => {
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      if (
        value === null ||
        value === '' ||
        value === 'null' ||
        value === 'undefined'
      ) {
        delete obj[key];
      } else if (typeof value === 'object' && value !== null) {
        clean(value as CleanableObject);
      }
    });
  };

  if (req.body && typeof req.body === 'object') {
    clean(req.body as CleanableObject);
  }

  next();
};

export default cleanJson;
