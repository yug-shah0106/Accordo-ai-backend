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

// Dummy user for testing/fallback (ID 13)
const dummyUser = {
  name: "Dummy User",
  email: "dummy@test.com",
  password: "Test@123",
  companyName: "Test Company 1",
};

export const seedUsers = async ({ transaction } = {}) => {
  // Seed admin users
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

  // Seed dummy user (for testing/fallback purposes)
  let company = await models.Company.findOne({
    where: { companyName: dummyUser.companyName },
    transaction,
  });
  
  // Create company if it doesn't exist
  if (!company) {
    [company] = await models.Company.findOrCreate({
      where: { companyName: dummyUser.companyName },
      defaults: { companyName: dummyUser.companyName },
      transaction,
    });
  }
  
  if (company) {
    const hashed = await hashPassword(dummyUser.password);
    const [user, created] = await models.User.findOrCreate({
      where: { email: dummyUser.email },
      defaults: {
        name: dummyUser.name,
        email: dummyUser.email,
        password: hashed,
        companyId: company.id,
      },
      transaction,
    });

    // If user was just created and doesn't have ID 13, we can't force it
    // But we can ensure it exists for fallback scenarios
    if (created) {
      console.log(`Created dummy user with ID: ${user.id} and email: ${user.email}`);
    } else {
      console.log(`Dummy user already exists with ID: ${user.id} and email: ${user.email}`);
    }
  }
};
