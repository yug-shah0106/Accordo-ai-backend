import { Request, Response, NextFunction } from 'express';
import { getPermissionService } from './permission.service.js';

export const getPermission = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await getPermissionService(req.context.userId);
    res.status(200).json({ message: 'Permission', data });
  } catch (error) {
    next(error);
  }
};
