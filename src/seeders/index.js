import models, { sequelize } from "../models/index.js";
import { seedCompanies } from "./companySeeder.js";
import { seedUsers } from "./userSeeder.js";
import { seedCustomers } from "./customerSeeder.js";
import { seedProducts } from "./productSeeder.js";
import { seedModules } from "./moduleSeeder.js";
import { seedSampleProducts } from "./sampleProductSeeder.js";
import { seedVendors } from "./vendorSeeder.js";
import { seedDataset } from "./datasetSeeder.js";
import { seedRequisition6 } from "./requisitionSeeder.js";

const registeredSeeders = [
  { name: "companies", handler: seedCompanies },
  { name: "admin-users", handler: seedUsers },
  { name: "customers", handler: seedCustomers },
  { name: "products-basic", handler: seedProducts },
  { name: "modules", handler: seedModules },
  { name: "products-detailed", handler: seedSampleProducts },
  { name: "vendors", handler: seedVendors },
  { name: "dataset", handler: seedDataset },
  { name: "requisition-6", handler: seedRequisition6 },
];

export const runSeeders = async ({ only, skip, transaction } = {}) => {
  const onlySet = only?.length ? new Set(only) : null;
  const skipSet = skip?.length ? new Set(skip) : new Set();

  for (const { name, handler } of registeredSeeders) {
    if (onlySet && !onlySet.has(name)) continue;
    if (skipSet.has(name)) continue;

    console.log(`Running seeder: ${name}`);
    await handler({ transaction });
  }
};

export const seedAll = async ({ only, skip } = {}) => {
  const transaction = await sequelize.transaction();
  try {
    await runSeeders({ only, skip, transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export default seedAll;
