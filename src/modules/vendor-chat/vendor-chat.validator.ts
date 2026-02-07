import Joi from 'joi';

/**
 * Validation schemas for vendor-chat module
 * All endpoints are public (no auth) - validation is key for security
 */

export const submitQuoteSchema = Joi.object({
  uniqueToken: Joi.string().required().min(10).max(100),
  contractDetails: Joi.object({
    products: Joi.array().items(
      Joi.object({
        productId: Joi.number().required(),
        productName: Joi.string().required(),
        quantity: Joi.number().required().min(0),
        quotedPrice: Joi.alternatives().try(
          Joi.number().min(0),
          Joi.string().allow('')
        ).required(),
        deliveryDate: Joi.string().allow('').optional(),
      })
    ).required(),
    additionalTerms: Joi.object({
      paymentTerms: Joi.string().allow('').optional(),
      netPaymentDay: Joi.alternatives().try(
        Joi.number().min(0),
        Joi.string().allow('')
      ).optional(),
      prePaymentPercentage: Joi.alternatives().try(
        Joi.number().min(0).max(100),
        Joi.string().allow('')
      ).optional(),
      postPaymentPercentage: Joi.alternatives().try(
        Joi.number().min(0).max(100),
        Joi.string().allow('')
      ).optional(),
      additionalNotes: Joi.string().allow('').optional(),
    }).optional(),
  }).required(),
});

export const editQuoteSchema = Joi.object({
  uniqueToken: Joi.string().required().min(10).max(100),
  contractDetails: Joi.object({
    products: Joi.array().items(
      Joi.object({
        productId: Joi.number().required(),
        productName: Joi.string().required(),
        quantity: Joi.number().required().min(0),
        quotedPrice: Joi.alternatives().try(
          Joi.number().min(0),
          Joi.string().allow('')
        ).required(),
        deliveryDate: Joi.string().allow('').optional(),
      })
    ).required(),
    additionalTerms: Joi.object({
      paymentTerms: Joi.string().allow('').optional(),
      netPaymentDay: Joi.alternatives().try(
        Joi.number().min(0),
        Joi.string().allow('')
      ).optional(),
      prePaymentPercentage: Joi.alternatives().try(
        Joi.number().min(0).max(100),
        Joi.string().allow('')
      ).optional(),
      postPaymentPercentage: Joi.alternatives().try(
        Joi.number().min(0).max(100),
        Joi.string().allow('')
      ).optional(),
      additionalNotes: Joi.string().allow('').optional(),
    }).optional(),
  }).required(),
});

export const uniqueTokenQuerySchema = Joi.object({
  uniqueToken: Joi.string().required().min(10).max(100),
});

export const enterChatSchema = Joi.object({
  uniqueToken: Joi.string().required().min(10).max(100),
});

export const sendMessageSchema = Joi.object({
  uniqueToken: Joi.string().required().min(10).max(100),
  content: Joi.string().required().min(1).max(5000),
});

export const pmResponseSchema = Joi.object({
  uniqueToken: Joi.string().required().min(10).max(100),
  vendorMessageId: Joi.string().required().uuid(),
});

export default {
  submitQuoteSchema,
  editQuoteSchema,
  uniqueTokenQuerySchema,
  enterChatSchema,
  sendMessageSchema,
  pmResponseSchema,
};
