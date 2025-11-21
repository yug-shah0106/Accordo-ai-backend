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
  return verifyJWT(token, env.jwt.accessSecret);
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
  if (method === "OPTIONS" || ["/api/auth/login"].includes(path)) {
    return next();
  }
  try {
    const apiKeyHeader = req.header("apiKey") || req.header("apikey");
    const apiSecretHeader = req.header("apiSecret") || req.header("apisecret");
    if (apiKeyHeader && apiSecretHeader) {
      req.context = await verifyJWT(apiKeyHeader, apiSecretHeader);
      return next();
    }
    const authHeader =
      req.header("Authorization") || req.header("authorization");
    req.context = await decodeToken(authHeader);
    next();
  } catch (error) {
    next(error);
  }
};
