import Joi from "joi";

/**
 * Joi validation options
 */
const options = {
  errors: {
    wrap: {
      label: "",
    },
  },
};

/**
 * Interface for validation result
 */
interface ValidationResult {
  error?: {
    details: Array<{ message: string }>;
  };
  value: unknown;
}

/**
 * Validate user creation data
 *
 * @param userData - User data to validate
 * @returns Validation result with error details if validation fails
 */
export const validateCreateUser = (userData: Record<string, unknown>): ValidationResult => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Email format is invalid",
      "any.required": "Email is required",
    }),
  }).unknown(true);

  return schema.validate(userData, options);
};

export default validateCreateUser;
