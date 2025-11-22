import env from "./src/config/env.js";
import logger from "./src/config/logger.js";
import { connectDatabase } from "./src/config/database.js";
import createExpressApp from "./src/loaders/express.js";
import "./src/models/index.js";

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  const errorLog = {
    error: {
      message: reason?.message || String(reason),
      stack: reason?.stack,
      name: reason?.name || "UnhandledRejection",
    },
    promise: promise.toString(),
    timestamp: new Date().toISOString(),
  };
  logger.error("Unhandled Promise Rejection:", errorLog);
  console.error("Unhandled Promise Rejection:", JSON.stringify(errorLog, null, 2));
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  const errorLog = {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    timestamp: new Date().toISOString(),
  };
  logger.error("Uncaught Exception:", errorLog);
  console.error("Uncaught Exception:", JSON.stringify(errorLog, null, 2));
  // Give time for logs to be written before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

(async () => {
  try {
    await connectDatabase();
    logger.info("Database connection established");
    console.info("Database connection established");

    const app = createExpressApp();
    app.listen(env.port, () => {
      logger.info(`Server listening on http://localhost:${env.port}`);
      console.info(`Server listening on http://localhost:${env.port}`);
    });
  } catch (error) {
    const errorLog = {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      timestamp: new Date().toISOString(),
    };
    logger.error("Failed to start application", errorLog);
    console.error("Failed to start application:", JSON.stringify(errorLog, null, 2));
    process.exit(1);
  }
})();
