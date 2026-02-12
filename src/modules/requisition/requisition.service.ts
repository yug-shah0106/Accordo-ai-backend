import repo from './requisition.repo.js';
import userRepo from '../user/user.repo.js';
import { CustomError } from '../../utils/custom-error.js';
import type { Requisition } from '../../models/requisition.js';
import type { RequisitionData, RequisitionProductData, RequisitionAttachmentData } from './requisition.repo.js';
import util from '../common/util.js';

export interface ProductData {
  productId: number;
  quantity: number;
  unitPrice?: number;
  gstType?: string;
  gstPercentage?: number;
  tds?: number;
  specification?: string;
}

export interface PaginatedRequisitionsResponse {
  data: Requisition[];
  total: number;
  page: number;
  totalPages: number;
}

export interface RequisitionFilters {
  status?: string;
  projectId?: number;
  vendorCount?: string;
  startDate?: string;
  endDate?: string;
}

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  path: string;
  size: number;
}

export const createRequisionService = async (
  requisitionData: RequisitionData,
  userId: number,
  attachmentFiles: MulterFile[] = []
): Promise<Requisition> => {
  try {
    const user = await userRepo.getUser(userId);
    if (!user?.companyId) {
      throw new CustomError('User company not found', 400);
    }

    const payload: RequisitionData = {
      ...requisitionData,
      companyId: user.companyId,
    };

    const requisition = await repo.createRequisition(payload);

    // Parse and create requisition products
    let productData: ProductData[] = [];
    if (requisitionData.productData) {
      if (Array.isArray(requisitionData.productData)) {
        productData = requisitionData.productData;
      } else if (typeof requisitionData.productData === 'string') {
        productData = JSON.parse(requisitionData.productData);
      }
    }

    if (productData.length > 0) {
      await Promise.all(
        productData.map((product: ProductData) =>
          repo.createRequisitionProduct({
            requisitionId: requisition.id,
            ...product,
          })
        )
      );
    }

    // Handle file attachments
    if (attachmentFiles && attachmentFiles.length > 0) {
      await Promise.all(
        attachmentFiles.map((file: MulterFile) =>
          repo.createRequisitionAttachment({
            requisitionId: requisition.id,
            filename: file.originalname,
            filepath: file.path,
            mimetype: file.mimetype,
            size: file.size,
          })
        )
      );
    }

    return requisition;
  } catch (error) {
    throw new CustomError((error as Error).message || String(error), 400);
  }
};

export const getRequisitionService = async (
  requisitionId: number
): Promise<Requisition | null> => {
  try {
    return repo.getRequisition({ id: requisitionId });
  } catch (error) {
    throw new CustomError(String(error), 400);
  }
};

export const getRequisitionsService = async (
  search: string | undefined,
  page: number | string = 1,
  limit: number | string = 10,
  projectId: number | undefined,
  userId: number,
  filters?: RequisitionFilters
): Promise<PaginatedRequisitionsResponse> => {
  try {
    const parsedPage = Number.parseInt(String(page), 10) || 1;
    const parsedLimit = Number.parseInt(String(limit), 10) || 10;
    const offset = (parsedPage - 1) * parsedLimit;

    const queryOptions: any = {
      where: {},
      limit: parsedLimit,
      offset,
    };

    if (search) {
      queryOptions.where = util.filterUtil(search as any);
    }

    if (projectId) {
      queryOptions.where.projectId = projectId;
    }

    // Apply additional filters
    if (filters) {
      if (filters.status) {
        queryOptions.where.status = filters.status;
      }
      if (filters.startDate || filters.endDate) {
        queryOptions.where.deliveryDate = {};
        if (filters.startDate) {
          queryOptions.where.deliveryDate.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          queryOptions.where.deliveryDate.$lte = new Date(filters.endDate);
        }
      }
    }

    // Handle vendor count filter (requires special handling in repo)
    if (filters?.vendorCount) {
      // This will be handled by the repository's contract counting logic
    }

    const { rows, count } = await repo.getRequisitions(queryOptions, userId);

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

export const updateRequisitionService = async (
  requisitionId: number,
  requisitionData: RequisitionData,
  userId: number,
  attachmentFiles: MulterFile[] = []
): Promise<[affectedCount: number]> => {
  try {
    const result = await repo.updateRequisition(requisitionId, requisitionData);

    // Update requisition products if provided
    let productData: ProductData[] = [];
    if (requisitionData.productData) {
      if (Array.isArray(requisitionData.productData)) {
        productData = requisitionData.productData;
      } else if (typeof requisitionData.productData === 'string') {
        productData = JSON.parse(requisitionData.productData);
      }
    }

    if (productData.length > 0) {
      // Delete existing products and recreate
      await repo.deleteRequisitionProducts(requisitionId);
      await Promise.all(
        productData.map((product: ProductData) =>
          repo.createRequisitionProduct({
            requisitionId,
            ...product,
          })
        )
      );
    }

    // Handle new file attachments
    if (attachmentFiles && attachmentFiles.length > 0) {
      await Promise.all(
        attachmentFiles.map((file: MulterFile) =>
          repo.createRequisitionAttachment({
            requisitionId,
            filename: file.originalname,
            filepath: file.path,
            mimetype: file.mimetype,
            size: file.size,
          })
        )
      );
    }

    return result;
  } catch (error) {
    throw new CustomError(String(error), 400);
  }
};

export const deleteRequisitionService = async (
  requisitionId: number
): Promise<number> => {
  try {
    // Delete associated products and attachments first
    await repo.deleteRequisitionProducts(requisitionId);
    await repo.deleteRequisitionAttachments(requisitionId);

    return repo.deleteRequisition({ id: requisitionId });
  } catch (error) {
    throw new CustomError(String(error), 400);
  }
};
