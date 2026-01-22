/**
 * Template Controller
 *
 * HTTP request handlers for template management endpoints.
 */

import type { Request, Response, NextFunction } from 'express';
import * as templateService from './template.service.js';
import { CustomError } from '../../utils/custom-error.js';

/**
 * Create a new negotiation template
 * POST /api/chatbot/templates
 */
export const createTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, description, configJson, isActive } = req.body;

    if (!name) {
      throw new CustomError('Template name is required', 400);
    }

    const template = await templateService.createTemplateService({
      name,
      description,
      configJson,
      isActive,
    });

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a template by ID
 * GET /api/chatbot/templates/:id
 */
export const getTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const includeParameters = req.query.includeParameters === 'true';

    const template = await templateService.getTemplateService(
      id,
      includeParameters
    );

    res.status(200).json({
      success: true,
      message: 'Template retrieved successfully',
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all templates
 * GET /api/chatbot/templates
 */
export const listTemplates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { isActive, page, limit } = req.query;

    const query: any = {};

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (page) {
      query.page = parseInt(page as string, 10);
    }

    if (limit) {
      query.limit = parseInt(limit as string, 10);
    }

    const result = await templateService.listTemplatesService(query);

    res.status(200).json({
      success: true,
      message: 'Templates retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a template by ID
 * PUT /api/chatbot/templates/:id
 */
export const updateTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, configJson, isActive } = req.body;

    const template = await templateService.updateTemplateService(id, {
      name,
      description,
      configJson,
      isActive,
    });

    res.status(200).json({
      success: true,
      message: 'Template updated successfully',
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a template by ID (soft delete)
 * DELETE /api/chatbot/templates/:id
 */
export const deleteTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    await templateService.deleteTemplateService(id);

    res.status(200).json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Permanently delete a template by ID
 * DELETE /api/chatbot/templates/:id/permanent
 */
export const permanentDeleteTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    await templateService.permanentDeleteTemplateService(id);

    res.status(200).json({
      success: true,
      message: 'Template permanently deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get the default template
 * GET /api/chatbot/templates/default
 */
export const getDefaultTemplate = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const template = await templateService.getDefaultTemplateService();

    if (!template) {
      res.status(200).json({
        success: true,
        message: 'No default template found',
        data: { template: null },
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Default template retrieved successfully',
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Set a template as default
 * POST /api/chatbot/templates/:id/set-default
 */
export const setDefaultTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { deactivateOthers } = req.body;

    const template = await templateService.setDefaultTemplateService(
      id,
      deactivateOthers === true
    );

    res.status(200).json({
      success: true,
      message: 'Default template set successfully',
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};
