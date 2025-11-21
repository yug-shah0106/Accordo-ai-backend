import crypto from "crypto";
import { Op } from "sequelize";
import repo from "./contract.repo.js";
import requisitionRepo from "../requisition/requisition.repo.js";
import CustomError from "../../utils/custom-error.js";
import util from "../common/util.js";

export const getContractDetailsService = async (uniqueToken) => {
  try {
    return repo.getContractDetails(uniqueToken);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const createContractService = async (contractData) => {
  try {
    return repo.createContract({
      ...contractData,
      status: "Created",
      uniqueToken: crypto.randomBytes(16).toString("hex"),
    });
  } catch (error) {
    throw new CustomError(error, 400);
  }
};

export const getContractService = async (contractId) => {
  try {
    return repo.getContract(contractId);
  } catch (error) {
    throw new CustomError(error, 400);
  }
};

export const getContractsService = async (
  search,
  page = 1,
  limit = 10,
  requisitionId,
  filters
) => {
  try {
    const offset = (page - 1) * limit;
    const queryOptions = {
      where: { requisitionId },
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    };

    if (search) {
      queryOptions.where.contractDetails = {
        [Op.like]: `%${search}%`,
      };
    }

    if (filters) {
      const filterData = JSON.parse(decodeURIComponent(filters));
      queryOptions.where = util.filterUtil(filterData);
    }

    const { rows, count } = await repo.getContracts(queryOptions);
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

const stringifyIfObject = (value) => {
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return value;
};

const applyStatusSideEffects = async (contractId, contractData) => {
  switch (contractData.status) {
    case "Opened":
      contractData.openedAt = new Date();
      break;
    case "Verified":
      contractData.verifiedAt = new Date();
      break;
    case "Accepted":
      contractData.acceptedAt = new Date();
      break;
    case "Rejected":
      contractData.rejectedAt = new Date();
      break;
    case "Expired":
      contractData.expiredAt = new Date();
      break;
    case "Approved": {
      const contractToApprove = await repo.getContract(contractId);
      if (!contractToApprove) {
        throw new CustomError("Contract not found", 404);
      }
      const requisition = await requisitionRepo.getRequisition(
        contractToApprove.requisitionId
      );
      if (requisition?.Contract) {
        for (const contract of requisition.Contract) {
          if (contract.id !== contractId) {
            await repo.updateContract(contract.id, {
              status: "Rejected",
              rejectedAt: new Date(),
              acceptedAt: null,
            });
          }
        }
      }
      await repo.updateContract(contractId, {
        status: "Accepted",
        rejectedAt: null,
        acceptedAt: new Date(),
      });
      return;
    }
    case "InitialQuotation":
      if (!contractData.contractDetails) {
        throw new CustomError("contractDetails is required", 400);
      }
      contractData.contractDetails = stringifyIfObject(contractData.contractDetails);
      contractData.quotedAt = new Date();
      break;
    case "Completed":
      if (!contractData.finalContractDetails) {
        throw new CustomError("finalContractDetails is required", 400);
      }
      contractData.finalContractDetails = stringifyIfObject(
        contractData.finalContractDetails
      );
      contractData.completedAt = new Date();
      break;
    default:
      break;
  }
};

export const updateContractService = async (
  contractId,
  contractData,
  userId,
  uniqueToken
) => {
  try {
    contractData.updatedBy = userId;
    await applyStatusSideEffects(contractId, contractData);

    if (uniqueToken) {
      await repo.updateContractByToken(uniqueToken, contractData);
    } else if (contractId) {
      await repo.updateContract(contractId, contractData);
    }

    const contract = contractId
      ? await repo.getContract(contractId)
      : await repo.getContractByToken(uniqueToken);

    if (!contract) {
      return null;
    }

    const requisitionId = contract.requisitionId;
    if (!requisitionId) {
      return contract;
    }

    const requisition = await requisitionRepo.getRequisition(requisitionId);
    const contracts = requisition?.Contract || [];
    if (contracts.length) {
      const allInitialQuotation = contracts.every(
        (item) => item.status === "InitialQuotation"
      );
      if (allInitialQuotation) {
        await requisitionRepo.updateRequisition(requisitionId, {
          status: "Created",
        });
      }
    }

    return contract;
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const updateContractStatusService = async (contractData) => {
  try {
    const { uniqueToken, status, finalContractDetails, message, end } = contractData;
    const updateData = {
      status,
      message,
      end,
    };

    if (status === "Accepted") {
      updateData.acceptedAt = new Date();
      updateData.rejectedAt = null;
    } else if (status === "Rejected") {
      updateData.rejectedAt = new Date();
      updateData.acceptedAt = null;
    }

    if (finalContractDetails) {
      updateData.finalContractDetails = stringifyIfObject(finalContractDetails);
    }

    await repo.updateContractByToken(uniqueToken, updateData);
    return repo.getContractDetails(uniqueToken);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const deleteContractService = async (contractId) => {
  try {
    return repo.deleteContract(contractId);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};
