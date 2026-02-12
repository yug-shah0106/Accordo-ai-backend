import Joi from 'joi';

const options: Joi.ValidationOptions = {
  errors: {
    wrap: {
      label: '',
    },
  },
};

/**
 * Validates vendor creation data
 * @param userData - The vendor data to validate
 * @returns Joi validation result
 */
export const validateCreateVendor = (userData: unknown): Joi.ValidationResult => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Email format is invalid',
      'any.required': 'Email is required',
    }),
  }).unknown(true);

  return schema.validate(userData, options);
};

export default validateCreateVendor;
