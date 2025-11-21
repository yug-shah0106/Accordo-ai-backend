import {
  createPoService,
  getAllPoService,
  getPoService,
  cancelPoService,
  downloadPoService,
} from "./po.service.js";

export const createPo = async (req, res, next) => {
  try {
    const data = await createPoService({
      ...req.body,
      addedBy: req.context.userId,
    });
    res.status(201).json({ message: "Po created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getPo = async (req, res, next) => {
  try {
    const data = await getPoService(req.params.poid);
    res.status(200).json({ message: "Po", data });
  } catch (error) {
    next(error);
  }
};

export const downloadPo = async (req, res, next) => {
  try {
    const buffer = await downloadPoService(req.params.poid);
    res.contentType("application/pdf");
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const getAllPo = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 10, filters } = req.query;
    const data = await getAllPoService(
      search,
      Number(page),
      Number(limit),
      req.context.userId,
      filters
    );
    res.status(200).json({ message: "Pos", ...data });
  } catch (error) {
    next(error);
  }
};

export const cancelPo = async (req, res, next) => {
  try {
    const data = await cancelPoService(req.params.poid);
    res.status(200).json({ message: "Po cancelled successfully", data });
  } catch (error) {
    next(error);
  }
};
