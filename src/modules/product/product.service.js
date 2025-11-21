import { Op } from "sequelize";
import repo from "./product.repo.js";
import userRepo from "../user/user.repo.js";
import CustomError from "../../utils/custom-error.js";

export const createProductService = async (productData, userId) => {
  try {
    const user = await userRepo.getUser(userId);
    if (!user?.companyId) {
      throw new CustomError("User company not found", 400);
    }
    const payload = {
      ...productData,
      companyId: user.companyId,
    };
    return repo.createProduct(payload);
  } catch (error) {
    throw new CustomError(error.message || error, 400);
  }
};

export const getAllProductService = async (userId) => {
  try {
    return repo.getAllProducts(userId);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const getProductsService = async (search, page = 1, limit = 10, userId) => {
  try {
    const parsedPage = Number.parseInt(page, 10) || 1;
    const parsedLimit = Number.parseInt(limit, 10) || 10;
    const offset = (parsedPage - 1) * parsedLimit;

    const queryOptions = {
      where: {},
      limit: parsedLimit,
      offset,
    };

    if (search) {
      queryOptions.where.productName = {
        [Op.like]: `%${search}%`,
      };
    }

    const { rows, count } = await repo.getProducts(queryOptions, userId);
    return {
      data: rows,
      total: count,
      page: parsedPage,
      totalPages: parsedLimit ? Math.ceil(count / parsedLimit) : 1,
    };
  } catch (error) {
    throw new CustomError(error.message || error, 400);
  }
};

export const getProductService = async (productData) => {
  try {
    return repo.getProduct(productData);
  } catch (error) {
    throw new CustomError(error, 400);
  }
};

export const updateProductService = async (productId, productData) => {
  try {
    return repo.updateProduct(productId, productData);
  } catch (error) {
    throw new CustomError(error, 400);
  }
};

export const deleteProductService = async (productData) => {
  try {
    return repo.deleteProduct(productData);
  } catch (error) {
    throw new CustomError(error, 400);
  }
};
