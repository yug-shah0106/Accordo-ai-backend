import logger from "../config/logger.js";
import CustomError from "../utils/custom-error.js";

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

const sanitizeRequestBody = (body) => {
  if (!body) return body;
  const sanitized = { ...body };
  // Remove sensitive fields from logging
  const sensitiveFields = ['password', 'apiSecret', 'apiKey', 'token', 'authorization'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  return sanitized;
};

export const errorHandler = (err, req, res, _next) => {
  // Determine status code
  // Priority: 1. err.statusCode (from CustomError/AppError), 2. Check error message for auth errors, 3. Default to 500
  let statusCode = err.statusCode;
  
  // If no statusCode set, check for common authentication/JWT errors
  if (!statusCode) {
    const errorMessage = err.message?.toLowerCase() || "";
    if (
      errorMessage.includes("jwt expired") ||
      errorMessage.includes("token expired") ||
      errorMessage.includes("authorization header missing") ||
      errorMessage.includes("invalid token") ||
      errorMessage.includes("authentication failed") ||
      errorMessage.includes("unauthorized") ||
      (err instanceof CustomError && !statusCode) // CustomError should always have statusCode, but double-check
    ) {
      statusCode = 401;
    } else {
      statusCode = 500; // Default to 500 for unexpected errors
    }
  }
  
  // Ensure CustomError and AppError instances use their statusCode
  if ((err instanceof CustomError || err instanceof AppError) && err.statusCode) {
    statusCode = err.statusCode;
  }

  const response = {
    message: err.message || "Internal Server Error",
  };

  if (err.details) {
    response.details = err.details;
  }

  // Prepare error log object with full context
  const errorLog = {
    error: {
      message: err.message || "Internal Server Error",
      name: err.name || "Error",
      statusCode,
      stack: err.stack,
      details: err.details,
      originalError: err.original ? {
        message: err.original.message,
        code: err.original.code,
        sql: err.original.sql,
      } : undefined,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      path: req.path,
      params: req.params,
      query: req.query,
      body: sanitizeRequestBody(req.body),
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'referer': req.headers['referer'],
      },
      ip: req.ip || req.connection.remoteAddress,
    },
    user: {
      userId: req.context?.userId,
      userEmail: req.context?.userEmail,
    },
    timestamp: new Date().toISOString(),
  };

  // Log all errors (both 4xx and 5xx) to both console and file
  if (statusCode >= 500) {
    // Server errors - log as error level
    logger.error("API Error (5xx):", errorLog);
    // Also log to console with full details
    console.error("API Error (5xx):", JSON.stringify(errorLog, null, 2));
  } else {
    // Client errors - log as warn level but still log full details
    logger.warn("API Error (4xx):", errorLog);
    // Also log to console
    console.warn("API Error (4xx):", JSON.stringify(errorLog, null, 2));
  }

  res.status(statusCode).json(response);
};
