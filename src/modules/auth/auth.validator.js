import Joi from "joi";

const options = {
  errors: {
    wrap: {
      label: "",
    },
  },
};

export const validateSignUp = (userData) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Email format is invalid",
      "any.required": "Email is required",
    }),
    name: Joi.string().min(1).required().messages({
      "string.min": "Name should at least minimum 1 character",
      "any.required": "Name is required",
    }),
    username: Joi.string().optional(),
    companyId: Joi.number().integer().optional(),
    password: Joi.string()
      .min(8)
      .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^a-zA-Z\\d]).+$"))
      .required()
      .messages({
        "string.min": "Password must have at least 8 characters.",
        "string.pattern.base":
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
        "any.required": "Password is required.",
      }),
  });

  return schema.validate(userData, options);
};

export const validateSignIn = (userData) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Email format is invalid",
      "any.required": "Email is required",
    }),
    password: Joi.string().required(),
  });
  return schema.validate(userData, options);
};

export const validateForgotPassword = (userData) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Email format is invalid",
      "any.required": "Email is required",
    }),
  });

  return schema.validate(userData, options);
};

export const validateUserId = (userData) => {
  const schema = Joi.object({
    user_id: Joi.number().integer().required(),
    password: Joi.string()
      .required()
      .messages({ "any.required": "New password is required" }),
  });

  return schema.validate(userData, options);
};

export const validateOtpData = (userData) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Email format is invalid",
      "any.required": "Email is required",
    }),
    otp: Joi.number()
      .integer()
      .required()
      .messages({ "any.required": "Otp is required" }),
  });

  return schema.validate(userData, options);
};

