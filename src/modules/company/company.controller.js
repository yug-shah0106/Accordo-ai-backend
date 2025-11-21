import {
  createCompanyService,
  getCompanyService,
  getCompaniesService,
  updadateCompanyService,
  deleteCompanyService,
} from "./company.service.js";

export const createCompany = async (req, res, next) => {
  try {
    const companyData = { ...req.body, createdBy: req.context?.userId };
    const files = req.files || [];
    const data = await createCompanyService(companyData, files);
    res.status(201).json({ message: "Company created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getAllCompany = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const data = await getCompaniesService(search, Number(page), Number(limit));
    res.status(200).json({ message: "Companies", data });
  } catch (error) {
    next(error);
  }
};

export const getCompany = async (req, res, next) => {
  try {
    const data = await getCompanyService(req.params.companyid);
    res.status(200).json({ message: "Company Details", data });
  } catch (error) {
    next(error);
  }
};

export const updateCompany = async (req, res, next) => {
  try {
    const { companyid } = req.params;
    const files = req.files || [];
    const data = await updadateCompanyService(
      companyid,
      req.body,
      req.context?.userId,
      files
    );
    res.status(200).json({ message: "Company updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const deleteCompany = async (req, res, next) => {
  try {
    const data = await deleteCompanyService(req.params.companyid);
    res.status(200).json({ message: "Company deleted successfully", data });
  } catch (error) {
    next(error);
  }
};
