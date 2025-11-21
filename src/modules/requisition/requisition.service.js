import { Op } from "sequelize";
import repo from "./requisition.repo.js";
import userRepo from "../user/user.repo.js";
import CustomError from "../../utils/custom-error.js";
import util from "../common/util.js";

export const createRequisionService = async (requisitionData, userId, attachmentFiles = []) => {
  try {
    const requisition = await repo.createRequisition({
      ...requisitionData,
      createdBy: userId,
      status: "Created",
    });

    const productPayload = requisitionData.productData;
    const products = Array.isArray(productPayload)
      ? productPayload
      : productPayload
      ? JSON.parse(productPayload)
      : [];

    await Promise.all(
      products.map((product) =>
        repo.createRequisitionProduct(
          requisition.id,
          product.productId,
          product.targetPrice,
          product.qty,
          product.maximum_price,
          userId
        )
      )
    );

    await Promise.all(
      (attachmentFiles || []).map((file) =>
        repo.createRequisitionAttachment(requisition.id, file.filename, userId)
      )
    );

    return requisition;
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const getRequisitionService = async (requisitionId) => {
  try {
    return repo.getRequisition(requisitionId);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const getRequisitionsService = async (
  search,
  page = 1,
  limit = 10,
  projectId,
  userId,
  filters
) => {
  try {
    const offset = (page - 1) * limit;
    const queryOptions = {
      where: {},
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    };

    if (search) {
      queryOptions.where.subject = {
        [Op.like]: `%${search}%`,
      };
    }

    const user = await userRepo.getUserProfile(userId);
    const companyId = user?.companyId;

    if (filters) {
      const filterData = JSON.parse(decodeURIComponent(filters));
      queryOptions.where = util.filterUtil(filterData);
      const vendorFilterIndex = filterData.findIndex((data) => data.filterBy === "totalVendors");
      if (
        vendorFilterIndex !== -1 &&
        Array.isArray(filterData[vendorFilterIndex].value) &&
        filterData[vendorFilterIndex].value.length === 2 &&
        Number.isInteger(filterData[vendorFilterIndex].value[0]) &&
        Number.isInteger(filterData[vendorFilterIndex].value[1])
      ) {
        queryOptions.totalVendors = filterData[vendorFilterIndex].value;
      }
    }

    const projectIds =
      projectId ?? (companyId ? await repo.getProjectIdsByCompanyId(companyId, queryOptions) : []);

    const { rows, count } = await repo.getRequisitions(projectIds, queryOptions);

    return {
      data: rows,
      total: count,
      page: parseInt(page, 10),
      totalPages: Math.ceil(count / limit),
    };
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const updateRequisitionService = async (
  requisitionId,
  requisitionData,
  userId,
  attachmentFiles = []
) => {
  try {
    const productPayload = requisitionData.productData;
    const products = Array.isArray(productPayload)
      ? productPayload
      : productPayload
      ? JSON.parse(productPayload)
      : [];

    if (products.length) {
      await repo.deleteRequisitionProduct(requisitionId);
      await Promise.all(
        products.map((product) =>
          repo.createRequisitionProduct(
            requisitionId,
            product.productId,
            product.targetPrice,
            product.qty,
            product.maximum_price,
            userId
          )
        )
      );
    }

    if (attachmentFiles.length) {
      await repo.deleteRequisitionAttachment(requisitionId);
      await Promise.all(
        attachmentFiles.map((file) =>
          repo.createRequisitionAttachment(requisitionId, file.filename, userId)
        )
      );
    }

    return repo.updateRequisition(requisitionId, requisitionData);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const deleteRequisitionService = async (requisitionId) => {
  try {
    return repo.deleteRequisition(requisitionId);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};
