import {
  signInService,
  signUpService,
  forgotPasswordService,
  verifyOtpService,
  resetPasswordService,
  changePasswordService,
  resetPasswordAutoService,
} from "./auth.service.js";

export const resetPassword = async (req, res, next) => {
  try {
    const { userid } = req.params;
    const { password } = req.body;
    const data = await resetPasswordService(userid, password);
    res.status(201).json({ message: "Password updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const resetPasswordAuto = async (req, res, next) => {
  try {
    const { userid } = req.params;
    const data = await resetPasswordAutoService(userid);
    res.status(201).json({ message: "Password updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const userData = { ...req.body, userId: req.context.userId };
    const data = await changePasswordService(userData);
    res.status(201).json({ message: "Password changed succesfully", data });
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (req, res, next) => {
  try {
    const data = await verifyOtpService(req.body);
    res.status(201).json({ message: "Password reset successful", data });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    await forgotPasswordService(req.body);
    res.status(201).json({
      message: "Forgot password email sent successfully",
      data: req.body.email,
    });
  } catch (error) {
    next(error);
  }
};

export const registerUser = async (req, res, next) => {
  try {
    const response = await signUpService(req.body);
    response.user.password = undefined;
    res.status(201).json({
      message: "Successfully signed up",
      data: response.user,
    });
  } catch (error) {
    next(error);
  }
};

export const signInUser = async (req, res, next) => {
  try {
    const response = await signInService(req.body);
    response.user.password = undefined;
    res.status(200).json({
      message: "Successfully signed in",
      data: response,
    });
  } catch (error) {
    next(error);
  }
};
