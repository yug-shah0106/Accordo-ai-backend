import env from './config/env.js';
import logger from './config/logger.js';
import { connectDatabase } from './config/database.js';
import createExpressApp from './loaders/express.js';
import './models/index.js';

interface ErrorWithStack extends Error {
  stack?: string;
}

interface RejectionReason {
  message?: string;
  stack?: string;
  name?: string;
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  const rejectionReason = reason as RejectionReason;
  const errorLog = {
    error: {
      message: rejectionReason?.message || String(reason),
      stack: rejectionReason?.stack,
      name: rejectionReason?.name || 'UnhandledRejection',
    },
    promise: promise.toString(),
    timestamp: new Date().toISOString(),
  };
  logger.error('Unhandled Promise Rejection:', errorLog);
  console.error('Unhandled Promise Rejection:', JSON.stringify(errorLog, null, 2));
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: ErrorWithStack) => {
  const errorLog = {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    timestamp: new Date().toISOString(),
  };
  logger.error('Uncaught Exception:', errorLog);
  console.error('Uncaught Exception:', JSON.stringify(errorLog, null, 2));
  // Give time for logs to be written before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

(async (): Promise<void> => {
  try {
    await connectDatabase();
    logger.info('Database connection established');
    console.info('Database connection established');

    const app = createExpressApp();
    app.listen(env.port, () => {
      logger.info(`Server listening on http://localhost:${env.port}`);
      console.info(`Server listening on http://localhost:${env.port}`);
    });
  } catch (error) {
    const err = error as ErrorWithStack;
    const errorLog = {
      error: {
        message: err.message,
        stack: err.stack,
        name: err.name,
      },
      timestamp: new Date().toISOString(),
    };
    logger.error('Failed to start application', errorLog);
    console.error('Failed to start application:', JSON.stringify(errorLog, null, 2));
    process.exit(1);
  }
})();
