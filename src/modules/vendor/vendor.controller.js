import {
  createVendorService,
  getVendorService,
  getVendorsService,
  updateVendorService,
  deleteVendorService,
} from "./vendor.service.js";

export const createVendor = async (req, res, next) => {
  try {
    const data = await createVendorService(req.body, req.context.userId);
    res.status(201).json({ message: "Vendor created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getVendor = async (req, res, next) => {
  try {
    const data = await getVendorService({ id: req.params.vendorid });
    res.status(200).json({ message: "Vendor", data });
  } catch (error) {
    next(error);
  }
};

export const getAllVendors = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 10, filters } = req.query;
    const data = await getVendorsService(
      req.context.userId,
      search,
      page,
      limit,
      filters
    );
    res.status(200).json({ message: "Vendors", ...data });
  } catch (error) {
    next(error);
  }
};

export const updateVendor = async (req, res, next) => {
  try {
    const data = await updateVendorService(req.params.vendorid, req.body);
    res.status(200).json({ message: "Vendor updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const deleteVendor = async (req, res, next) => {
  try {
    const data = await deleteVendorService(req.params.vendorid);
    res.status(200).json({ message: "Vendor deleted successfully", data });
  } catch (error) {
    next(error);
  }
};
