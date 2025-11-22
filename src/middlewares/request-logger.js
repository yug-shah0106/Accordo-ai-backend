import logger from "../config/logger.js";

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

export const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      user: {
        userId: req.context?.userId,
        userEmail: req.context?.userEmail,
      },
      ip: req.ip || req.connection.remoteAddress,
    };

    // Include request details for errors
    if (res.statusCode >= 400) {
      logData.request = {
        params: req.params,
        query: req.query,
        body: sanitizeRequestBody(req.body),
      };
    }

    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;

    if (res.statusCode >= 500) {
      logger.error(message, logData);
      console.error(`error: ${message}`, logData);
    } else if (res.statusCode >= 400) {
      logger.warn(message, logData);
      console.warn(`warn: ${message}`, logData);
    } else {
      logger.info(message, logData);
      console.info(`info: ${message}`, logData);
    }
  });

  next();
};
