import logger from "../config/logger.js";

export class AppError extends Error {
  constructor(message, statusCode = 500, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const notFoundHandler = (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
};

export const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const response = {
    message: err.message || "Internal Server Error",
  };

  if (err.details) {
    response.details = err.details;
  }

  if (statusCode >= 500) {
    logger.error(err);
  }

  res.status(statusCode).json(response);
};
