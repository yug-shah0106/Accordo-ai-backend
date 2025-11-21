import models, { sequelize } from "../../models/index.js";

const repo = {
  getUserProfile: async (userId) => {
    return models.User.findOne({ where: { id: userId } });
  },
  assignRole: async (userId, roleId) => {
    return models.User.update({ roleId }, { where: { id: userId } });
  },
  getAllUsers: async (queryOptions = {}) => {
    queryOptions.include = [
      {
        model: models.Role,
        as: "Role",
      },
    ];
    if (queryOptions.role) {
      queryOptions.having = sequelize.literal(
        `"Role"."name" = '${queryOptions.role}'`
      );
    }
    return models.User.findAndCountAll(queryOptions);
  },
  getUser: async (userId) => {
    return models.User.findByPk(userId, {
      include: {
        model: models.Role,
        as: "Role",
        include: {
          model: models.RolePermission,
          as: "RolePermission",
        },
      },
    });
  },
  updateUser: async (userId, userData) => {
    return models.User.update(userData, { where: { id: userId } });
  },
};

export default repo;
