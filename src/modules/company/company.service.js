import { Op } from "sequelize";
import companyRepo from "./company.repo.js";
import CustomError from "../../utils/custom-error.js";

const natureEnum = ["Domestic", "Interational"];
const employeesEnum = ["0-10", "10-100", "100-1000", "1000+"];
const industryEnum = ["Industry1", "Industry2"];
const currencyEnum = ["INR", "USD", "EUR"];

const validateEnumField = (value, validValues, fieldName) => {
  if (value && !validValues.includes(value)) {
    throw new CustomError(
      `Invalid value '${value}' for field '${fieldName}'. Valid values are: ${validValues.join(", ")}`,
      400
    );
  }
};

export const createCompanyService = async (companyData, files = []) => {
  try {
    // Validate enum fields
    validateEnumField(companyData.nature, natureEnum, "nature");
    validateEnumField(companyData.numberOfEmployees, employeesEnum, "numberOfEmployees");
    validateEnumField(companyData.industryType, industryEnum, "industryType");
    validateEnumField(companyData.typeOfCurrency, currencyEnum, "typeOfCurrency");

    if (files.length > 0) {
      companyData.companyLogo = files[0].filename;
    }
    return companyRepo.createCompany(companyData);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const getCompanyService = async (companyId) => {
  try {
    return companyRepo.getCompany(companyId);
  } catch (error) {
    throw new CustomError(error.message || error, 400);
  }
};

export const getCompaniesService = async (search, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    const queryOptions = {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
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
      page: parseInt(page, 10),
      totalPages: Math.ceil(count / limit),
    };
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const updadateCompanyService = async (
  companyId,
  companyData,
  userId,
  attachmentFiles = []
) => {
  try {
    // Validate enum fields if they are being updated
    validateEnumField(companyData.nature, natureEnum, "nature");
    validateEnumField(companyData.numberOfEmployees, employeesEnum, "numberOfEmployees");
    validateEnumField(companyData.industryType, industryEnum, "industryType");
    validateEnumField(companyData.typeOfCurrency, currencyEnum, "typeOfCurrency");

    for (const file of attachmentFiles) {
      switch (file.fieldname) {
        case "companyLogo":
          companyData.companyLogo = file.filename;
          break;
        case "gstFile":
          companyData.gstFileUrl = file.filename;
          break;
        case "panFile":
          companyData.panFileUrl = file.filename;
          break;
        case "msmeFile":
          companyData.msmeFileUrl = file.filename;
          break;
        case "ciFile":
          companyData.ciFileUrl = file.filename;
          break;
        case "cancelledChequeURL":
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

export const deleteCompanyService = async (companyId) => {
  try {
    return companyRepo.deleteCompany(companyId);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};
