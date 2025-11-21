import models from "../../models/index.js";
import { Op } from "sequelize";

const repo = {
  updatePassword: async (userId, password) => {
    return models.User.update(
      { password },
      {
        where: {
          id: userId,
        },
      }
    );
  },

  verifyOTP: async (userData) => {
    return models.User.findOne({
      where: { email: userData.email },
      include: [
        {
          model: models.Otp,
          as: "Otps",
          where: {
            for: "forgot_password",
            otp: userData.otp,
            createdAt: { [Op.lt]: Date.now() + 3600000 },
          },
          order: [["createdAt", "DESC"]],
        },
      ],
    });
  },

  findUser: async (id, withPassword = false) => {
    if (withPassword) {
      return models.User.scope("withPassword").findByPk(id);
    }
    return models.User.findByPk(id);
  },

  findUserByEmail: async (email) => {
    return models.User.scope("withPassword").findOne({
      where: { email },
      include: {
        model: models.Role,
        as: "Role",
        attributes: ["name"],
        include: {
          model: models.RolePermission,
          as: "RolePermission",
          attributes: ["moduleId", "permission"],
        },
      },
    });
  },

  createUser: async (userData) => {
    return models.User.create(userData);
  },
};

export default repo;

