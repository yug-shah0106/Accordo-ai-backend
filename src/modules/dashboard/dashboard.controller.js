import { getDashboardService } from "./dashboard.service.js";

export const getDashboardData = async (req, res, next) => {
  try {
    const data = await getDashboardService(req.context.userId, req.query.dayYear);
    res.status(200).json({ message: "Dashboard Data", data });
  } catch (error) {
    next(error);
  }
};
