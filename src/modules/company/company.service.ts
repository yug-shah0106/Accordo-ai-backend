import { Op } from 'sequelize';
import companyRepo from './company.repo.js';
import CustomError from '../../utils/custom-error.js';
import type { Company, CompanyNature, EmployeesRange, IndustryType, CurrencyType } from '../../models/company.js';

/**
 * Enum definitions for company fields
 * Note: 'Interational' is a legacy typo, 'International' is the correct spelling
 */
const natureEnum: readonly CompanyNature[] = ['Domestic', 'Interational', 'International'] as const;
const employeesEnum: readonly EmployeesRange[] = ['0-10', '10-100', '100-1000', '1000+'] as const;
const industryEnum: readonly IndustryType[] = ['Industry1', 'Industry2'] as const;
const currencyEnum: readonly CurrencyType[] = ['INR', 'USD', 'EUR'] as const;

/**
 * File upload interface from multer
 */
interface UploadedFile {
  fieldname: string;
  filename: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
}

/**
 * Company data interface for creation/update operations
 */
interface CompanyData extends Partial<Company> {
  nature?: CompanyNature;
  numberOfEmployees?: EmployeesRange;
  industryType?: IndustryType;
  typeOfCurrency?: CurrencyType;
  companyLogo?: string;
  gstFileUrl?: string;
  panFileUrl?: string;
  msmeFileUrl?: string;
  ciFileUrl?: string;
  cancelledChequeURL?: string;
  createdBy?: number;
  updatedBy?: number;
}

/**
 * Paginated response interface
 */
interface PaginatedResponse {
  data: Company[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Validates enum field values
 * @param value - Value to validate
 * @param validValues - Array of valid values
 * @param fieldName - Name of the field for error message
 * @throws CustomError if value is invalid
 */
const validateEnumField = <T>(
  value: T | undefined | null,
  validValues: readonly T[],
  fieldName: string
): void => {
  if (value && !validValues.includes(value)) {
    throw new CustomError(
      `Invalid value '${value}' for field '${fieldName}'. Valid values are: ${validValues.join(', ')}`,
      400
    );
  }
};

/**
 * Creates a new company
 * @param companyData - Company data to create
 * @param files - Optional uploaded files
 * @returns Created company instance
 */
export const createCompanyService = async (
  companyData: CompanyData,
  files: UploadedFile[] = []
): Promise<Company> => {
  try {
    // Validate enum fields
    validateEnumField(companyData.nature, natureEnum, 'nature');
    validateEnumField(companyData.numberOfEmployees, employeesEnum, 'numberOfEmployees');
    validateEnumField(companyData.industryType, industryEnum, 'industryType');
    validateEnumField(companyData.typeOfCurrency, currencyEnum, 'typeOfCurrency');

    if (files.length > 0) {
      companyData.companyLogo = files[0].filename;
    }
    return companyRepo.createCompany(companyData);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

/**
 * Gets a single company by ID
 * @param companyId - Company ID to retrieve
 * @returns Company instance
 */
export const getCompanyService = async (companyId: number): Promise<Company | null> => {
  try {
    return companyRepo.getCompany(companyId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CustomError(message, 400);
  }
};

/**
 * Gets paginated list of companies with optional search
 * @param search - Optional search query
 * @param page - Page number (default: 1)
 * @param limit - Items per page (default: 10)
 * @returns Paginated company list
 */
export const getCompaniesService = async (
  search?: string,
  page: number = 1,
  limit: number = 10
): Promise<PaginatedResponse> => {
  try {
    const offset = (page - 1) * limit;
    const queryOptions: Parameters<typeof companyRepo.getAllCompanies>[0] = {
      limit: parseInt(String(limit), 10),
      offset: parseInt(String(offset), 10),
    };

    if (search) {
      queryOptions.where = {
        contractDetails: {
          [Op.like]: `%${search}%`,
        },
      };
    }

    const { rows, count } = await companyRepo.getAllCompanies(queryOptions);
    return {
      data: rows,
      total: count,
      page: parseInt(String(page), 10),
      totalPages: Math.ceil(count / limit),
    };
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

/**
 * Updates a company
 * @param companyId - Company ID to update
 * @param companyData - Updated company data
 * @param userId - ID of user performing the update
 * @param attachmentFiles - Optional uploaded files
 * @returns Update result
 */
export const updadateCompanyService = async (
  companyId: number,
  companyData: CompanyData,
  userId: number | undefined,
  attachmentFiles: UploadedFile[] = []
): Promise<[affectedCount: number]> => {
  try {
    // Validate enum fields if they are being updated
    validateEnumField(companyData.nature, natureEnum, 'nature');
    validateEnumField(companyData.numberOfEmployees, employeesEnum, 'numberOfEmployees');
    validateEnumField(companyData.industryType, industryEnum, 'industryType');
    validateEnumField(companyData.typeOfCurrency, currencyEnum, 'typeOfCurrency');

    for (const file of attachmentFiles) {
      switch (file.fieldname) {
        case 'companyLogo':
          companyData.companyLogo = file.filename;
          break;
        case 'gstFile':
          companyData.gstFileUrl = file.filename;
          break;
        case 'panFile':
          companyData.panFileUrl = file.filename;
          break;
        case 'msmeFile':
          companyData.msmeFileUrl = file.filename;
          break;
        case 'ciFile':
          companyData.ciFileUrl = file.filename;
          break;
        case 'cancelledChequeURL':
          companyData.cancelledChequeURL = file.filename;
          break;
        default:
          break;
      }
    }
    companyData.updatedBy = userId;
    return companyRepo.updateCompany(companyId, companyData);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

/**
 * Deletes a company
 * @param companyId - Company ID to delete
 * @returns Number of deleted records
 */
export const deleteCompanyService = async (companyId: number): Promise<number> => {
  try {
    return companyRepo.deleteCompany(companyId);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

/**
 * Address summary interface for delivery locations
 */
export interface AddressSummary {
  id: string;
  name: string;
  address: string;
  type: 'company' | 'project';
  isDefault: boolean;
}

/**
 * Gets delivery addresses for a user
 * Aggregates addresses from user's company and associated projects
 * Admin users see all addresses
 * @param userId - User ID to get addresses for
 * @returns List of delivery addresses
 */
export const getAddressesService = async (userId: number): Promise<AddressSummary[]> => {
  try {
    return companyRepo.getAddresses(userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CustomError(message, 400);
  }
};
