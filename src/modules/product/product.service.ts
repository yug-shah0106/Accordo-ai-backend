import { Op } from 'sequelize';
import repo from './product.repo.js';
import userRepo from '../user/user.repo.js';
import { CustomError } from '../../utils/custom-error.js';
import type { Product } from '../../models/product.js';

export interface ProductData {
  productName?: string;
  category?: string;
  brandName?: string;
  gstType?: string;
  gstPercentage?: number;
  tds?: number;
  type?: string;
  UOM?: string;
}

export interface PaginatedProductsResponse {
  data: Product[];
  total: number;
  page: number;
  totalPages: number;
}

export const createProductService = async (
  productData: ProductData,
  userId: number
): Promise<Product> => {
  try {
    const user = await userRepo.getUser(userId);
    if (!user?.companyId) {
      throw new CustomError('User company not found', 400);
    }
    const payload = {
      ...productData,
      companyId: user.companyId,
    };
    return repo.createProduct(payload as any);
  } catch (error) {
    throw new CustomError((error as Error).message || String(error), 400);
  }
};

export const getAllProductService = async (userId: number): Promise<Product[]> => {
  try {
    return repo.getAllProducts(userId);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const getProductsService = async (
  search: string | undefined,
  page: number | string = 1,
  limit: number | string = 10,
  userId: number
): Promise<PaginatedProductsResponse> => {
  try {
    const parsedPage = Number.parseInt(String(page), 10) || 1;
    const parsedLimit = Number.parseInt(String(limit), 10) || 10;
    const offset = (parsedPage - 1) * parsedLimit;

    const queryOptions: {
      where: Record<string, unknown>;
      limit: number;
      offset: number;
    } = {
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
    throw new CustomError((error as Error).message || String(error), 400);
  }
};

export const getProductService = async (productData: {
  id: number;
}): Promise<Product | null> => {
  try {
    return repo.getProduct(productData);
  } catch (error) {
    throw new CustomError(String(error), 400);
  }
};

export const updateProductService = async (
  productId: number,
  productData: ProductData
): Promise<[affectedCount: number]> => {
  try {
    return repo.updateProduct(productId, productData as any);
  } catch (error) {
    throw new CustomError(String(error), 400);
  }
};

export const deleteProductService = async (productData: {
  id: number;
}): Promise<number> => {
  try {
    return repo.deleteProduct(productData);
  } catch (error) {
    throw new CustomError(String(error), 400);
  }
};
