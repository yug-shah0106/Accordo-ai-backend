import { Router } from "express";
import {
  signInUser,
  registerUser,
  forgotPassword,
  verifyOtp,
  resetPassword,
  changePassword,
  resetPasswordAuto,
} from "./auth.controller.js";
import { authMiddleware, checkPermission } from "../../middlewares/auth.middleware.js";

const authRouter = Router();
const moduleId = 2;

authRouter.post("/register", registerUser);
authRouter.post("/login", signInUser);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/verify-otp", verifyOtp);
authRouter.put("/reset-password/:userid", resetPassword);
authRouter.put("/reset-password-auto/:userid", resetPasswordAuto);
authRouter.post(
  "/change-password",
  authMiddleware,
  (req, res, next) => checkPermission(req, res, next, moduleId, 2),
  changePassword
);

export default authRouter;
