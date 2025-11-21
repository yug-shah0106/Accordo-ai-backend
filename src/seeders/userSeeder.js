import models from "../models/index.js";
import { hashPassword } from "./utils.js";

const adminUsers = [
  {
    name: "John Doe",
    email: "ak75963@gmail.com",
    password: "Welcome@56",
    companyName: "Test Company 1",
  },
];

export const seedUsers = async ({ transaction } = {}) => {
  for (const userData of adminUsers) {
    const company = await models.Company.findOne({
      where: { companyName: userData.companyName },
      transaction,
    });
    if (!company) continue;

    const hashed = await hashPassword(userData.password);
    await models.User.findOrCreate({
      where: { email: userData.email },
      defaults: {
        name: userData.name,
        email: userData.email,
        password: hashed,
        companyId: company.id,
      },
      transaction,
    });
  }
};
