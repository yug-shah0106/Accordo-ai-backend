import Joi from 'joi';

/**
 * Validation schema for creating a project
 */
export const createProjectSchema = Joi.object({
  projectName: Joi.string().required().min(1).max(255),
  description: Joi.string().allow('', null).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  budget: Joi.number().positive().optional(),
  status: Joi.string().optional(),
  pointOfContact: Joi.array().items(Joi.number().integer()).optional(),
});

/**
 * Validation schema for updating a project
 */
export const updateProjectSchema = Joi.object({
  projectName: Joi.string().min(1).max(255).optional(),
  description: Joi.string().allow('', null).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  budget: Joi.number().positive().optional(),
  status: Joi.string().optional(),
  pointOfContact: Joi.array().items(Joi.number().integer()).optional(),
});

/**
 * Validation schema for project ID parameter
 */
export const projectIdSchema = Joi.object({
  projectid: Joi.string().required(),
});
