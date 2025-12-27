import {
  createRequisionService,
  getRequisitionService,
  getRequisitionsService,
  updateRequisitionService,
  deleteRequisitionService,
} from "./requisition.service.js";

export const createRequisition = async (req, res, next) => {
  try {
    const data = await createRequisionService(req.body, req.context.userId, req.files || []);
    res.status(201).json({ message: "Requisition created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getRequisition = async (req, res, next) => {
  try {
    const requisitionId = parseInt(req.params.requisitionid, 10);
    if (isNaN(requisitionId)) {
      return res.status(400).json({ message: "Invalid requisition ID" });
    }
    const data = await getRequisitionService(requisitionId);
    if (!data) {
      return res.status(404).json({ message: "Requisition not found" });
    }
    res.status(200).json({ message: "Requisition", data });
  } catch (error) {
    next(error);
  }
};

export const getAllRequisition = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 10, projectid, filters } = req.query;
    const data = await getRequisitionsService(
      search,
      Number(page),
      Number(limit),
      projectid,
      req.context.userId,
      filters
    );
    res.status(200).json({ message: "Requisitions", ...data });
  } catch (error) {
    next(error);
  }
};

export const updateRequisition = async (req, res, next) => {
  try {
    const { requisitionid } = req.params;
    const data = await updateRequisitionService(
      requisitionid,
      req.body,
      req.context.userId,
      req.files || []
    );
    res.status(200).json({ message: "Requisition updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const deleteRequisition = async (req, res, next) => {
  try {
    const data = await deleteRequisitionService(req.params.requisitionid);
    res.status(200).json({ message: "Requisition deleted successfully", data });
  } catch (error) {
    next(error);
  }
};
