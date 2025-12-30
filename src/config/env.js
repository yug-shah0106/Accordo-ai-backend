import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  openaiApiKey: process.env.OPENAI_API_KEY,
  port: Number(process.env.PORT || 8000),
  logLevel: process.env.LOG_LEVEL || "info",
  database: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 5432),
    name: process.env.DB_NAME || "accordo",
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    adminDatabase: process.env.DB_ADMIN_DATABASE || "postgres",
    ssl: process.env.DB_SSL === "true",
    sslRejectUnauthorized:
      process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
    logging: process.env.DB_LOGGING === "true",
  },
  jwt: {
    accessSecret:
      process.env.JWT_ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "change-me",
    refreshSecret:
      process.env.JWT_REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || "change-me",
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || "1h",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || "7d",
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 100),
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM_EMAIL,
  },
  redisUrl: process.env.REDIS_URL,
  llm: {
    baseURL: process.env.LLM_BASE_URL || "http://localhost:11434",
    model: process.env.LLM_MODEL || "llama3.2",
    timeout: Number(process.env.LLM_TIMEOUT || 60000),
  },
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
      : "*",  // Allow all origins by default
    credentials: process.env.CORS_ORIGIN ? true : false,  // credentials only with specific origins
  },
  // Frontend URLs for email links
  vendorPortalUrl: process.env.VENDOR_PORTAL_URL || "http://localhost:3000/vendor",
  chatbotFrontendUrl: process.env.CHATBOT_FRONTEND_URL || "http://localhost:5173",
  chatbotApiUrl: process.env.CHATBOT_API_URL || "http://localhost:4000/api",
};

export default env;
