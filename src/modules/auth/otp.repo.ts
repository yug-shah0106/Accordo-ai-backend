import models from "../../models/index.js";

/**
 * OTP data for creation
 */
interface OtpData {
  user_id: number;
  for: string;
  otp: string;
  createdAt?: Date;
}

const repo = {
  /**
   * Create a new OTP record
   * @param otpData - OTP data to create
   * @returns Created OTP record
   */
  createOtp: async (otpData: OtpData): Promise<unknown> => {
    return models.Otp.create(otpData);
  },
};

export default repo;
