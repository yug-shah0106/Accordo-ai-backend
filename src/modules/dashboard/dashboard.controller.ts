import { Request, Response, NextFunction } from 'express';
import { getDashboardService, getStatsService } from './dashboard.service.js';

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

export const getStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const period = (req.query.period as string) || '30d';
    const data = await getStatsService(req.context.userId, period as any);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
