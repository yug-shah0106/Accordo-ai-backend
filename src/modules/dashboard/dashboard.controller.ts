import { Request, Response, NextFunction } from 'express';
import { getDashboardService } from './dashboard.service.js';

export const getDashboardData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await getDashboardService(
      req.context.userId,
      req.query.dayYear as string
    );
    res.status(200).json({ message: 'Dashboard Data', data });
  } catch (error) {
    next(error);
  }
};
