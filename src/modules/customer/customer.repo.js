import models from "../../models/index.js";
import { Op } from "sequelize";

const repo = {
  getCustomers: async (companyId) => {
    return models.User.findAll({
      where: { companyId, userType: "customer" },
    });
  },

  getAllCustomers: async (queryOptions = {}) => {
    const options = {
      ...queryOptions,
      where: {
        ...(queryOptions.where || {}),
        userType: "customer",
      },
    };

    return models.User.findAndCountAll(options);
  },
};

export default repo;
