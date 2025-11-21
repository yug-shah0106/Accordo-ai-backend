import models from "../models/index.js";
import { Op } from "sequelize";
import { findOrCreateBulk } from "./utils.js";

const companies = [{ companyName: "Test Company 1" }, { companyName: "Accordo Enterprises Pvt Ltd" }];

export const seedCompanies = async ({ transaction } = {}) => {
  await findOrCreateBulk(models.Company, companies, "companyName", { transaction });
  return models.Company.findAll({
    where: { companyName: { [Op.in]: companies.map((c) => c.companyName) } },
    transaction,
  });
};
