import {
  createContractService,
  getContractService,
  getContractsService,
  updateContractService,
  deleteContractService,
  getContractDetailsService,
  updateContractStatusService,
} from "./contract.service.js";

export const getContractDetails = async (req, res, next) => {
  try {
    const contractDetails = await getContractDetailsService(req.query.uniquetoken);
    res.status(200).json({ message: "Contract Details", data: contractDetails });
  } catch (error) {
    next(error);
  }
};

export const createContract = async (req, res, next) => {
  try {
    const data = await createContractService({
      ...req.body,
      createdBy: req.context.userId,
    });
    res.status(201).json({ message: "Contract created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getContract = async (req, res, next) => {
  try {
    const data = await getContractService(req.params.contractid);
    res.status(200).json({ message: "Contract", data });
  } catch (error) {
    next(error);
  }
};

export const getAllContract = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 10, requisitionid, filters } = req.query;
    const data = await getContractsService(
      search,
      Number(page),
      Number(limit),
      requisitionid,
      filters
    );
    res.status(200).json({ message: "Contracts", ...data });
  } catch (error) {
    next(error);
  }
};

const resolveUserId = (context) => context?.userId;

export const completeContract = async (req, res, next) => {
  try {
    const userId = resolveUserId(req.context);
    const payload = {
      ...req.body,
      updatedBy: userId,
      status: "Completed",
    };
    const data = await updateContractService(null, payload, userId, req.body.uniqueToken);
    res.status(200).json({ message: "Contract updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const approveContract = async (req, res, next) => {
  try {
    const userId = resolveUserId(req.context);
    const data = await updateContractService(
      req.params.contractid,
      { ...req.body, status: "Approved" },
      userId
    );
    res.status(200).json({ message: "Contract approved successfully", data });
  } catch (error) {
    next(error);
  }
};

export const updateContract = async (req, res, next) => {
  try {
    const userId = resolveUserId(req.context);
    const data = await updateContractService(
      req.params.contractid,
      req.body,
      userId,
      req.body.uniqueToken
    );
    res.status(200).json({ message: "Contract updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const deleteContract = async (req, res, next) => {
  try {
    const data = await deleteContractService(req.params.contractid);
    res.status(200).json({ message: "Contract deleted successfully", data });
  } catch (error) {
    next(error);
  }
};

export const updateContractStatus = async (req, res, next) => {
  try {
    if (!req.body.uniqueToken) {
      return res.status(400).json({ message: "uniqueToken is required" });
    }
    const data = await updateContractStatusService(req.body);
    res.status(200).json({ message: "Contract status updated successfully", data });
  } catch (error) {
    next(error);
  }
};
