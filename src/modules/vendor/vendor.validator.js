import Joi from "joi";

const options = {
  errors: {
    wrap: {
      label: "",
    },
  },
};

export const validateCreateVendor = (userData) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Email format is invalid",
      "any.required": "Email is required",
    }),
  }).unknown(true);

  return schema.validate(userData, options);
};

export default validateCreateVendor;
