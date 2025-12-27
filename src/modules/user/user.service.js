import crypto from "crypto";
import bcrypt from "bcrypt";
import { Op } from "sequelize";

import repo from "./user.repo.js";
import authRepo from "../auth/auth.repo.js";
import companyRepo from "../company/company.repo.js";
import CustomError from "../../utils/custom-error.js";
import { verifyJWT, generateJWT } from "../../middlewares/jwt.service.js";
import util from "../common/util.js";
import { validateCreateUser } from "./user.validator.js";
import env from "../../config/env.js";

export const getUserProfileService = async (accessToken) => {
  try {
    if (!accessToken) {
      throw new CustomError("Access token is required", 400);
    }
    const decoded = await verifyJWT(accessToken, env.jwt.accessSecret);
    const user = await repo.getUserProfile(decoded.userId);
    if (!user) {
      throw new CustomError("User not found", 404);
    }
    return user;
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const assignRoleService = async (userId, roleId) => {
  try {
    return repo.assignRole(userId, roleId);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const getAllUsersService = async (
  search,
  page = 1,
  limit = 10,
  userId,
  filters
) => {
  try {
    const parsedPage = Number.parseInt(page, 10) || 1;
    const parsedLimit = Number.parseInt(limit, 10) || 10;
    const offset = (parsedPage - 1) * parsedLimit;

    const user = await repo.getUser(userId);
    const queryOptions = {
      where: { companyId: user?.companyId },
      limit: parsedLimit,
      offset,
    };

    if (search) {
      queryOptions.where = {
        ...queryOptions.where,
        name: {
          [Op.like]: `%${search}%`,
        },
      };
    }

    if (filters) {
      try {
        const filterData = JSON.parse(decodeURIComponent(filters));
        queryOptions.where = {
          ...util.filterUtil(filterData),
          ...queryOptions.where,
        };
        const indexRole = filterData.findIndex((item) => item.filterBy === "role");
        if (indexRole !== -1) {
          queryOptions.role = filterData[indexRole].value;
        }
      } catch (error) {
        throw new CustomError("Invalid filters format", 400);
      }
    }

    const { rows, count } = await repo.getAllUsers(queryOptions);
    return {
      data: rows,
      total: count,
      page: parsedPage,
      totalPages: parsedLimit ? Math.ceil(count / parsedLimit) : 1,
    };
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const createUserService = async (userData, userId) => {
  try {
    const { error } = validateCreateUser(userData);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const existing = await authRepo.findUserByEmail(userData.email);
    if (existing) {
      throw new CustomError(`Email ${userData.email} already exists`, 409);
    }

    if (userId) {
      const user = await repo.getUser(userId);
      userData.companyId = user?.companyId;
    }

    userData.password = await bcrypt.hash(userData.password, 10);
    const createdUser = await authRepo.createUser(userData);

    const apiSecret = crypto.randomBytes(32).toString("hex");
    const payload = {
      userId: createdUser.id,
      companyId: userData.companyId,
    };
    const apiKey = await generateJWT(payload, apiSecret);
    await companyRepo.updateCompany(userData.companyId, {
      apiKey: apiKey.replace(/^Bearer\s+/i, ""),
      apiSecret,
    });

    return createdUser;
  } catch (error) {
    throw new CustomError(error, 400);
  }
};

export const getUserService = async (userId) => {
  try {
    return repo.getUser(userId);
  } catch (error) {
    throw new CustomError(error, 400);
  }
};

export const updateUserService = async (userId, userData) => {
  try {
    return repo.updateUser(userId, userData);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};
