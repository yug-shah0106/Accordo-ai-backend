import models from "../models/index.js";

const modules = [
  "Project Details",
  "User Management",
  "Requisiton Management",
  "Product Management",
  "Vendor Management",
];

export const seedModules = async ({ transaction } = {}) => {
  for (const name of modules) {
    await models.Module.findOrCreate({
      where: { name },
      defaults: { name, isArchived: false },
      transaction,
    });
  }
};
