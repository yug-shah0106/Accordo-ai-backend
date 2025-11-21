import models from "../../models/index.js";

const repo = {
  createOtp: async (otpData) => {
    return models.Otp.create(otpData);
  },
};

export default repo;

