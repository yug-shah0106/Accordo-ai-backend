import repo from "./vendor.repo.js";
import userRepo from "../user/user.repo.js";
import authRepo from "../auth/auth.repo.js";
import CustomError from "../../utils/custom-error.js";
import util from "../common/util.js";
import { validateCreateVendor } from "./vendor.validator.js";

const parseRange = (value) => {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1])
  ) {
    return value;
  }
  return null;
};

export const createVendorService = async (vendorData, userId) => {
  const { error } = validateCreateVendor(vendorData);
  if (error) {
    throw new CustomError(error.details[0].message, 400);
  }

  const existing = await authRepo.findUserByEmail(vendorData.email);
  if (existing) {
    throw new CustomError(`Email ${vendorData.email} already exists`, 409);
  }

  const user = await userRepo.getUser(userId);
  if (!user) {
    throw new CustomError("User not found", 404);
  }

  const newVendor = await repo.createVendor(vendorData);
  const vendorCompany = await repo.createVendorCompany({
    vendorId: newVendor.id,
    companyId: user.companyId,
  });

  return [newVendor, vendorCompany];
};

export const getVendorsService = async (
  userId,
  search,
  page = 1,
  limit = 10,
  filters
) => {
  const parsedPage = Number.parseInt(page, 10) || 1;
  const parsedLimit = Number.parseInt(limit, 10) || 10;
  const offset = (parsedPage - 1) * parsedLimit;

  const queryOptions = {
    limit: parsedLimit,
    offset,
    search,
  };

  if (filters) {
    try {
      const filterData = JSON.parse(decodeURIComponent(filters));
      const transformedFilters = util.filterUtil(filterData);
      if (Object.keys(transformedFilters).length) {
        queryOptions.filters = transformedFilters;
      }

      const totalContractsFilter = filterData.find((item) => item.filterBy === "totalContracts");
      const completedContractsFilter = filterData.find(
        (item) => item.filterBy === "completedContracts"
      );
      const vendorStatusFilter = filterData.find((item) => item.filterBy === "vendorStatus");

      const totalRange = parseRange(totalContractsFilter?.value);
      if (totalRange) {
        queryOptions.totalContractsRange = totalRange;
      }

      const completedRange = parseRange(completedContractsFilter?.value);
      if (completedRange) {
        queryOptions.completedContractsRange = completedRange;
      }

      if (Array.isArray(vendorStatusFilter?.value) && vendorStatusFilter.value.length) {
        const cleaned = vendorStatusFilter.value.filter((val) => typeof val === "string");
        if (cleaned.length) {
          queryOptions.vendorStatusList = cleaned;
        }
      }
    } catch (error) {
      throw new CustomError("Invalid filters format", 400);
    }
  }

  const user = await userRepo.getUserProfile(userId);
  if (!user?.companyId) {
    throw new CustomError("Unable to determine company for user", 400);
  }

  const { response, vendorCount } = await repo.getAllVendorCompany(user.companyId, queryOptions);
  const { rows, count } = response;

  const total = count;
  const totalPages = parsedLimit ? Math.ceil(total / parsedLimit) : 1;

  return {
    data: rows,
    total,
    page: parsedPage,
    totalPages,
    totalVendors: vendorCount.totalVendors,
    activeVendors: vendorCount.activeActiveVendors,
    inactiveVendors: vendorCount.totalInactiveVendors,
  };
};

export const getVendorService = async (vendorData) => {
  try {
    return await repo.getVendor(vendorData);
  } catch (error) {
    throw new CustomError(error, 400);
  }
};

export const updateVendorService = async (vendorId, vendorData) => {
  try {
    return await repo.updateVendor(vendorId, vendorData);
  } catch (error) {
    throw new CustomError(error, 400);
  }
};

export const deleteVendorService = async (vendorId) => {
  try {
    return await repo.deleteVendor({ id: vendorId });
  } catch (error) {
    throw new CustomError(error, 400);
  }
};
