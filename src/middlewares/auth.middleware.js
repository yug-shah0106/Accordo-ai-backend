import CustomError from "../utils/custom-error.js";
import { verifyJWT } from "./jwt.service.js";
import env from "../config/env.js";
import { checkPermissionService } from "../modules/role/role.service.js";
import util from "../modules/common/util.js";

const decodeToken = async (header) => {
  if (!header) {
    throw new CustomError("Authorization header missing", 401);
  }
  const token = header.replace(/^Bearer\s+/i, "");
  try {
    return await verifyJWT(token, env.jwt.accessSecret);
  } catch (error) {
    // Convert JWT errors to proper HTTP errors
    if (error.message === "jwt expired") {
      throw new CustomError("Token expired. Please refresh your token", 401);
    }
    if (error.message === "invalid signature" || error.message === "jwt malformed") {
      throw new CustomError("Invalid token", 401);
    }
    throw new CustomError(error.message || "Authentication failed", 401);
  }
};

export const log = async (req, res, next, moduleName, action) => {
  try {
    await util.logUserAction(req.context?.userId, moduleName, action);
    next();
  } catch (error) {
    next(error);
  }
};

export const checkPermission = async (req, res, next, moduleId, permission) => {
  try {
    if (!req.context || !req.context.userId) {
      throw new CustomError("Authentication required", 401);
    }
    const allowed = await checkPermissionService(
      req.context.userId,
      moduleId,
      permission
    );
    if (allowed) {
      return next();
    }
    throw new CustomError("You are not authorized", 401);
  } catch (error) {
    next(error);
  }
};

export const authMiddleware = async (req, res, next) => {
  const { method, path } = req;
  // Allow refresh token endpoint without auth
  if (method === "OPTIONS" || ["/api/auth/login", "/api/auth/refresh-token"].includes(path)) {
    return next();
  }
  try {
    const apiKeyHeader = req.header("apiKey") || req.header("apikey");
    const apiSecretHeader = req.header("apiSecret") || req.header("apisecret");
    if (apiKeyHeader && apiSecretHeader) {
      try {
        req.context = await verifyJWT(apiKeyHeader, apiSecretHeader);
        return next();
      } catch (error) {
        // Convert JWT errors to proper HTTP errors for API key/secret
        if (error.message === "jwt expired") {
          throw new CustomError("Token expired. Please refresh your token", 401);
        }
        if (error.message === "invalid signature" || error.message === "jwt malformed") {
          throw new CustomError("Invalid token", 401);
        }
        throw new CustomError(error.message || "Authentication failed", 401);
      }
    }
    const authHeader =
      req.header("Authorization") || req.header("authorization");
    req.context = await decodeToken(authHeader);
    next();
  } catch (error) {
    // Ensure all authentication errors have proper status code
    if (error instanceof CustomError) {
      next(error);
    } else {
      // If it's not a CustomError, convert it to one with 401 status
      next(new CustomError(error.message || "Authentication failed", 401));
    }
  }
};
