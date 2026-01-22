import repo from './vendor.repo.js';
import userRepo from '../user/user.repo.js';
import authRepo from '../auth/auth.repo.js';
import { CustomError } from '../../utils/custom-error.js';
import util from '../common/util.js';
import { validateCreateVendor } from './vendor.validator.js';
import type { User } from '../../models/user.js';
import type { VendorCompany } from '../../models/vendorCompany.js';

interface VendorData {
  email: string;
  name?: string;
  phone?: string;
  companyId?: number;
  roleId?: number;
  status?: string;
  [key: string]: unknown;
}

interface FilterData {
  moduleName: string;
  filterBy: string;
  controlType: "inputText" | "rangeNumeric" | "rangeDate" | "checkbox";
  value: string | number[] | string[];
}

interface VendorServiceResponse {
  data: unknown[];
  total: number;
  page: number;
  totalPages: number;
  totalVendors: number;
  activeVendors: number;
  inactiveVendors: number;
}

/**
 * Parse range filter value to ensure it's a valid [min, max] tuple
 */
const parseRange = (value: unknown): [number, number] | null => {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1])
  ) {
    return value as [number, number];
  }
  return null;
};

/**
 * Create a new vendor
 */
export const createVendorService = async (
  vendorData: VendorData,
  userId: number
): Promise<[User, VendorCompany]> => {
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
    throw new CustomError('User not found', 404);
  }

  const newVendor = await repo.createVendor(vendorData);
  const vendorCompany = await repo.createVendorCompany({
    vendorId: newVendor.id,
    companyId: user.companyId,
  });

  return [newVendor, vendorCompany];
};

/**
 * Get all vendors with filtering and pagination
 * Admin users (userType === 'admin') see all vendors across all companies
 */
export const getVendorsService = async (
  userId: number,
  search?: string,
  page: string | number = 1,
  limit: string | number = 10,
  filters?: string
): Promise<VendorServiceResponse> => {
  const parsedPage = Number.parseInt(String(page), 10) || 1;
  const parsedLimit = Number.parseInt(String(limit), 10) || 10;
  const offset = (parsedPage - 1) * parsedLimit;

  const queryOptions: {
    limit: number;
    offset: number;
    search?: string;
    filters?: Record<string, unknown>;
    totalContractsRange?: [number, number];
    completedContractsRange?: [number, number];
    vendorStatusList?: string[];
  } = {
    limit: parsedLimit,
    offset,
    search,
  };

  if (filters) {
    try {
      const filterData = JSON.parse(decodeURIComponent(filters)) as FilterData[];
      const transformedFilters = util.filterUtil(filterData);
      if (Object.keys(transformedFilters).length) {
        queryOptions.filters = transformedFilters;
      }

      const totalContractsFilter = filterData.find((item) => item.filterBy === 'totalContracts');
      const completedContractsFilter = filterData.find(
        (item) => item.filterBy === 'completedContracts'
      );
      const vendorStatusFilter = filterData.find((item) => item.filterBy === 'vendorStatus');

      const totalRange = parseRange(totalContractsFilter?.value);
      if (totalRange) {
        queryOptions.totalContractsRange = totalRange;
      }

      const completedRange = parseRange(completedContractsFilter?.value);
      if (completedRange) {
        queryOptions.completedContractsRange = completedRange;
      }

      if (Array.isArray(vendorStatusFilter?.value) && vendorStatusFilter.value.length) {
        const cleaned = vendorStatusFilter.value.filter((val): val is string => typeof val === 'string');
        if (cleaned.length) {
          queryOptions.vendorStatusList = cleaned;
        }
      }
    } catch (error) {
      throw new CustomError('Invalid filters format', 400);
    }
  }

  const user = await userRepo.getUserProfile(userId);

  // Admin users see all vendors across all companies
  const isAdmin = user?.userType === 'admin';

  if (isAdmin) {
    // For admin users, get all vendors from all companies
    const { response, vendorCount } = await repo.getAllVendorsForAdmin(queryOptions);
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
  }

  // Non-admin users only see their company's vendors
  if (!user?.companyId) {
    throw new CustomError('Unable to determine company for user', 400);
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

/**
 * Get a specific vendor by ID
 */
export const getVendorService = async (vendorData: { id: number }): Promise<User | null> => {
  try {
    return await repo.getVendor(vendorData);
  } catch (error) {
    throw new CustomError((error as Error).message || String(error), 400);
  }
};

/**
 * Update a vendor's data
 */
export const updateVendorService = async (
  vendorId: string | number,
  vendorData: Partial<VendorData>
): Promise<[number]> => {
  try {
    const id = typeof vendorId === 'string' ? Number.parseInt(vendorId, 10) : vendorId;
    return await repo.updateVendor(id, vendorData);
  } catch (error) {
    throw new CustomError((error as Error).message || String(error), 400);
  }
};

/**
 * Delete a vendor by ID
 */
export const deleteVendorService = async (vendorId: string | number): Promise<number> => {
  try {
    const id = typeof vendorId === 'string' ? Number.parseInt(vendorId, 10) : vendorId;
    return await repo.deleteVendor({ id });
  } catch (error) {
    throw new CustomError((error as Error).message || String(error), 400);
  }
};
