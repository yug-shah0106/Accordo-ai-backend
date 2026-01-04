import Joi from 'joi';

/**
 * Chatbot Validation Schemas
 */

/**
 * Schema for creating a deal
 */
export const createDealSchema = Joi.object({
  title: Joi.string().required().min(1).max(255).messages({
    'string.empty': 'Title is required',
    'string.max': 'Title cannot exceed 255 characters',
  }),
  counterparty: Joi.string().allow('', null).optional(),
  mode: Joi.string()
    .valid('INSIGHTS', 'CONVERSATION')
    .default('CONVERSATION')
    .optional(),
  templateId: Joi.string().uuid().allow(null).optional(),
  requisitionId: Joi.number().integer().positive().allow(null).optional(),
  contractId: Joi.number().integer().positive().allow(null).optional(),
  vendorId: Joi.number().integer().positive().allow(null).optional(),
});

/**
 * Schema for processing a vendor message
 */
export const processMessageSchema = Joi.object({
  content: Joi.string().required().min(1).messages({
    'string.empty': 'Message content is required',
  }),
  role: Joi.string().valid('VENDOR', 'ACCORDO', 'SYSTEM').default('VENDOR').optional(),
});

/**
 * Schema for creating a system message
 */
export const createSystemMessageSchema = Joi.object({
  content: Joi.string().required().min(1).messages({
    'string.empty': 'Message content is required',
  }),
});

/**
 * Schema for deal ID parameter
 */
export const dealIdSchema = Joi.object({
  dealId: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid deal ID format',
    'any.required': 'Deal ID is required',
  }),
});

/**
 * Schema for list deals query parameters
 */
export const listDealsQuerySchema = Joi.object({
  status: Joi.string()
    .valid('NEGOTIATING', 'ACCEPTED', 'WALKED_AWAY', 'ESCALATED')
    .optional(),
  mode: Joi.string().valid('INSIGHTS', 'CONVERSATION').optional(),
  archived: Joi.string().valid('true', 'false').optional(),
  deleted: Joi.string().valid('true', 'false').optional(),
  userId: Joi.number().integer().positive().optional(),
  vendorId: Joi.number().integer().positive().optional(),
  page: Joi.number().integer().positive().default(1).optional(),
  limit: Joi.number().integer().positive().max(100).default(10).optional(),
});

/**
 * Middleware function to validate request body
 */
export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
    }

    req.body = value;
    next();
  };
};

/**
 * Middleware function to validate request params
 */
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
    }

    req.params = value;
    next();
  };
};

/**
 * Middleware function to validate query parameters
 */
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
    }

    req.query = value;
    next();
  };
};
