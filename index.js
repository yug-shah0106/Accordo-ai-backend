import env from "./src/config/env.js";
import logger from "./src/config/logger.js";
import { connectDatabase } from "./src/config/database.js";
import createExpressApp from "./src/loaders/express.js";
import "./src/models/index.js";

(async () => {
  try {
    await connectDatabase();
    logger.info("Database connection established");

    const app = createExpressApp();
    app.listen(env.port, () => {
      logger.info(`Server listening on http://localhost:${env.port}`);
    });
  } catch (error) {
    logger.error("Failed to start application", error);
    process.exit(1);
  }
})();
