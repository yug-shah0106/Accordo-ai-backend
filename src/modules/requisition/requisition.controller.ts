import { Request, Response, NextFunction } from 'express';
import {
  createRequisionService,
  getRequisitionService,
  getRequisitionsService,
  deleteRequisitionService,
  updateRequisitionService,
} from './requisition.service.js';

export const createRequisition = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const attachmentFiles = req.files as Express.Multer.File[];
    const data = await createRequisionService(
      req.body,
      req.context.userId,
      attachmentFiles
    );
    res.status(201).json({ message: 'Requisition created successfully', data });
  } catch (error) {
    next(error);
  }
};

export const getAllRequisitions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { search, page = '1', limit = '10', projectId, ...filters } = req.query;
    const data = await getRequisitionsService(
      search as string | undefined,
      page as string,
      limit as string,
      projectId ? Number(projectId) : undefined,
      req.context.userId,
      filters
    );
    res.status(200).json({ message: 'Requisitions', ...data });
  } catch (error) {
    next(error);
  }
};

export const getRequisition = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const requisitionId = Number(req.params.requisitionid);
    if (Number.isNaN(requisitionId)) {
      res.status(400).json({ message: 'Invalid requisition ID' });
      return;
    }
    const data = await getRequisitionService(requisitionId);
    res.status(200).json({ message: 'Requisition', data });
  } catch (error) {
    next(error);
  }
};

export const updateRequisition = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const requisitionId = Number(req.params.requisitionid);
    if (Number.isNaN(requisitionId)) {
      res.status(400).json({ message: 'Invalid requisition ID' });
      return;
    }
    const attachmentFiles = req.files as Express.Multer.File[];
    const data = await updateRequisitionService(
      requisitionId,
      req.body,
      req.context.userId,
      attachmentFiles
    );
    res.status(200).json({ message: 'Requisition updated successfully', data });
  } catch (error) {
    next(error);
  }
};

export const deleteRequisition = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const requisitionId = Number(req.params.requisitionid);
    if (Number.isNaN(requisitionId)) {
      res.status(400).json({ message: 'Invalid requisition ID' });
      return;
    }
    const data = await deleteRequisitionService(requisitionId);
    res.status(200).json({ message: 'Requisition deleted successfully', data });
  } catch (error) {
    next(error);
  }
};
