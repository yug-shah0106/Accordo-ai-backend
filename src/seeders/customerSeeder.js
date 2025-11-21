import models from "../models/index.js";

const customers = [
  {
    name: "Test Customer 1",
    email: "abhishek.todquest@gmail.com",
    companyName: "Test Company 1",
  },
];

export const seedCustomers = async ({ transaction } = {}) => {
  for (const customer of customers) {
    const company = await models.Company.findOne({
      where: { companyName: customer.companyName },
      transaction,
    });
    if (!company) continue;

    await models.User.findOrCreate({
      where: { email: customer.email },
      defaults: {
        name: customer.name,
        email: customer.email,
        companyId: company.id,
      },
      transaction,
    });
  }
};
