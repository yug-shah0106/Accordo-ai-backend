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
    const uniqueToken = req.query.uniquetoken;
    if (!uniqueToken || typeof uniqueToken !== "string" || uniqueToken.trim().length === 0) {
      return res.status(400).json({ message: "uniqueToken is required" });
    }
    const contractDetails = await getContractDetailsService(uniqueToken);
    res.status(200).json({ message: "Contract Details", data: contractDetails });
  } catch (error) {
    next(error);
  }
};

export const createContract = async (req, res, next) => {
  try {
    // Extract options from request body
    const { skipEmail, skipChatbot, ...contractData } = req.body;

    const data = await createContractService(
      {
        ...contractData,
        createdBy: req.context.userId,
      },
      { skipEmail, skipChatbot }
    );
    res.status(201).json({ message: "Contract created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getContract = async (req, res, next) => {
  try {
    const contractId = parseInt(req.params.contractid, 10);
    if (isNaN(contractId) || contractId <= 0) {
      return res.status(400).json({ message: "Invalid contract ID" });
    }
    const data = await getContractService(contractId);
    res.status(200).json({ message: "Contract", data });
  } catch (error) {
    next(error);
  }
};

export const getAllContract = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 10, requisitionid, filters } = req.query;
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    
    if (isNaN(parsedPage) || parsedPage < 1) {
      return res.status(400).json({ message: "Invalid page number" });
    }
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({ message: "Invalid limit. Must be between 1 and 100" });
    }
    
    const parsedRequisitionId = requisitionid ? parseInt(requisitionid, 10) : null;
    if (requisitionid && (isNaN(parsedRequisitionId) || parsedRequisitionId <= 0)) {
      return res.status(400).json({ message: "Invalid requisition ID" });
    }
    
    const data = await getContractsService(
      search,
      parsedPage,
      parsedLimit,
      parsedRequisitionId,
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
    const contractId = parseInt(req.params.contractid, 10);
    if (isNaN(contractId) || contractId <= 0) {
      return res.status(400).json({ message: "Invalid contract ID" });
    }
    const userId = resolveUserId(req.context);
    const data = await updateContractService(
      contractId,
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
    const contractId = parseInt(req.params.contractid, 10);
    if (isNaN(contractId) || contractId <= 0) {
      return res.status(400).json({ message: "Invalid contract ID" });
    }
    
    if (!req.context || !req.context.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const userId = resolveUserId(req.context);
    if (!userId) {
      return res.status(401).json({ message: "User ID not found in context" });
    }
    
    const data = await updateContractService(
      contractId,
      req.body,
      userId,
      req.body.uniqueToken
    );
    
    if (!data) {
      return res.status(404).json({ message: "Contract not found" });
    }
    
    res.status(200).json({ message: "Contract updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const deleteContract = async (req, res, next) => {
  try {
    const contractId = parseInt(req.params.contractid, 10);
    if (isNaN(contractId) || contractId <= 0) {
      return res.status(400).json({ message: "Invalid contract ID" });
    }
    const data = await deleteContractService(contractId);
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
