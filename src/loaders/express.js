import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import toobusy from "toobusy-js";
import env from "../config/env.js";
import { requestLogger } from "../middlewares/request-logger.js";
import { errorHandler, notFoundHandler } from "../middlewares/error-handler.js";
import routes from "../routes/index.js";

export const createExpressApp = () => {
  const app = express();

  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors());

  app.use(
    rateLimit({
      windowMs: env.rateLimit.windowMs,
      max: env.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.use((req, res, next) => {
    if (toobusy()) {
      res.status(503).json({ message: "Server is busy, please try again" });
    } else {
      next();
    }
  });

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use(requestLogger);

  app.use("/api", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createExpressApp;
