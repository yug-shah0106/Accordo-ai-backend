import { Op } from "sequelize";
import repo from "./customer.repo.js";
import userRepo from "../user/user.repo.js";
import CustomError from "../../utils/custom-error.js";

export const getCustomersService = async (userId) => {
  try {
    const user = await userRepo.getUserProfile(userId);
    if (!user?.companyId) {
      throw new CustomError("User company not found", 400);
    }
    return repo.getCustomers(user.companyId);
  } catch (error) {
    throw new CustomError(error.message || error, 400);
  }
};

export const getAllCustomerService = async (search, page = 1, limit = 10) => {
  try {
    const parsedPage = Number.parseInt(page, 10) || 1;
    const parsedLimit = Number.parseInt(limit, 10) || 10;
    const offset = (parsedPage - 1) * parsedLimit;

    const queryOptions = {
      limit: parsedLimit,
      offset,
      where: {},
    };

    if (search) {
      queryOptions.where.name = {
        [Op.like]: `%${search}%`,
      };
    }

    const { rows, count } = await repo.getAllCustomers(queryOptions);
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
