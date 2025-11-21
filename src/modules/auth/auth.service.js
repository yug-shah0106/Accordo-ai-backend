import crypto from "crypto";
import nodemailer from "nodemailer";
import { compareSync, hash } from "bcrypt";

import {
  validateSignIn,
  validateSignUp,
  validateForgotPassword,
  validateOtpData,
  validateUserId,
} from "./auth.validator.js";
import repo from "./auth.repo.js";
import companyRepo from "../company/company.repo.js";
import otpRepo from "./otp.repo.js";
import { generateJWT } from "../../middlewares/jwt.service.js";
import { getRoleService } from "../role/role.service.js";
import CustomError from "../../utils/custom-error.js";
import env from "../../config/env.js";

const { smtp, jwt } = env;

const buildTransporter = () => {
  if (!smtp.host || !smtp.user) {
    throw new CustomError("SMTP configuration missing", 500);
  }
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port || 587,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });
};

export const resetPasswordService = async (userId, password) => {
  const { error } = validateUserId({ user_id: userId, password });
  if (error) {
    throw new CustomError(error.details[0].message, 400);
  }

  const hashedPassword = await hash(password, 10);
  return repo.updatePassword(userId, hashedPassword);
};

const generateStrongPassword = () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}|;:,.<>?";
  let password = "";
  const length = 8;
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    password += characters[randomIndex];
  }
  return password;
};

export const resetPasswordAutoService = async (userId) => {
  const password = generateStrongPassword();
  const hashedPassword = await hash(password, 10);

  await repo.updatePassword(userId, hashedPassword);
  const user = await repo.findUser(userId);
  if (!user) {
    throw new CustomError("User not found", 404);
  }

  const transporter = buildTransporter();
  const mailOptions = {
    to: user.email,
    from: smtp.from,
    subject: "Password Reset Successful",
    text: `Your new password is ${password}`,
  };

  return transporter.sendMail(mailOptions);
};

export const verifyOtpService = async (resetPasswordData) => {
  const { error } = validateOtpData(resetPasswordData);
  if (error) {
    throw new CustomError(error.details[0].message, 400);
  }

  const user = await repo.verifyOTP(resetPasswordData);
  if (!user) {
    throw new CustomError("Email incorrect or OTP invalid.", 409);
  }

  return user;
};

export const forgotPasswordService = async (userData) => {
  const { error } = validateForgotPassword(userData);
  if (error) {
    throw new CustomError(error.details[0].message, 400);
  }

  const user = await repo.findUserByEmail(userData.email);
  if (!user) {
    throw new CustomError("User not found", 409);
  }

  const otp = crypto.randomInt(100000, 1000000);
  await otpRepo.createOtp({
    user_id: user.id,
    for: "forgot_password",
    otp,
    createdAt: Date.now(),
  });

  const transporter = buildTransporter();
  const mailOptions = {
    to: user.email,
    from: smtp.from,
    subject: "Password Reset OTP",
    text: `Your OTP for password reset is ${otp}. It is valid for 1 hour.`,
  };

  return transporter.sendMail(mailOptions);
};

export const signUpService = async (userData) => {
  const { error } = validateSignUp(userData);
  if (error) {
    throw new CustomError(error.details[0].message, 400);
  }

  const existing = await repo.findUserByEmail(userData.email);
  if (existing) {
    throw new CustomError(`Email ${userData.email} already exists`, 409);
  }

  const username = `${userData.email}`;
  const hashedPassword = await hash(userData.password, 10);
  const company = await companyRepo.createCompany();
  userData.companyId = company.id;

  const newUser = await repo.createUser({
    ...userData,
    username,
    password: hashedPassword,
  });

  const apiSecret = crypto.randomBytes(32).toString("hex");
  const payload = {
    userId: newUser.id,
    companyId: userData.companyId,
  };
  const apiKey = await generateJWT(payload, apiSecret);
  await companyRepo.updateCompany(userData.companyId, {
    apiKey: apiKey.replace("Bearer ", ""),
    apiSecret,
  });

  return { user: newUser };
};

export const changePasswordService = async (userData) => {
  const hashedPassword = await hash(userData.newPassword, 10);
  const user = await repo.findUser(userData.userId, true);
  if (!user) {
    throw new CustomError("Email entered is invalid", 401);
  }
  if (!user.password) {
    throw new CustomError("Old password doesn't exist", 401);
  }
  const validateCurrentPassword = compareSync(
    userData.currentPassword,
    user.password
  );
  if (!validateCurrentPassword) {
    throw new CustomError("Current password entered is invalid", 401);
  }
  return repo.updatePassword(user.id, hashedPassword);
};

export const signInService = async (userData) => {
  const { error } = validateSignIn(userData);
  if (error) {
    throw new CustomError(error.details[0].message, 400);
  }

  const user = await repo.findUserByEmail(userData.email);
  if (!user) {
    throw new CustomError("Email or password is invalid", 400);
  }

  const validPassword = compareSync(userData.password, user.password);
  if (!validPassword) {
    throw new CustomError("Email or password is invalid", 400);
  }

  let payload = {
    userId: user.id,
  };

  if (user.roleId) {
    const role = await getRoleService(user.roleId);
    payload = {
      userId: user.id,
      roleData: role,
    };
  }

  const accessToken = await generateJWT(payload, jwt.accessSecret, {
    expiresIn: jwt.accessExpiry,
  });

  return { user, accessToken };
};
