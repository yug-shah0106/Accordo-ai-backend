import type { Request, Response, NextFunction } from 'express';
import {
  createVendorService,
  getVendorService,
  getVendorsService,
  updateVendorService,
  deleteVendorService,
} from './vendor.service.js';

/**
 * Create a new vendor
 */
export const createVendor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await createVendorService(req.body, req.context.userId);
    res.status(201).json({ message: 'Vendor created successfully', data });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific vendor by ID
 */
export const getVendor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const vendorId = Number.parseInt(req.params.vendorid, 10);
    const data = await getVendorService({ id: vendorId });
    res.status(200).json({ message: 'Vendor', data });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all vendors with filtering and pagination
 */
export const getAllVendors = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { search, page = 1, limit = 10, filters } = req.query;
    const data = await getVendorsService(
      req.context.userId,
      search as string | undefined,
      page as string | number,
      limit as string | number,
      filters as string | undefined
    );
    res.status(200).json({ message: 'Vendors', ...data });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a vendor's data
 */
export const updateVendor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await updateVendorService(req.params.vendorid, req.body);
    res.status(200).json({ message: 'Vendor updated successfully', data });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a vendor by ID
 */
export const deleteVendor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await deleteVendorService(req.params.vendorid);
    res.status(200).json({ message: 'Vendor deleted successfully', data });
  } catch (error) {
    next(error);
  }
};
