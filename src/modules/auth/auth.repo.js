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
            createdAt: { [Op.gt]: new Date(Date.now() - 3600000) },
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
      include: [
        {
          model: models.Role,
          as: "Role",
          required: false,
          attributes: ["name"],
          include: [
            {
              model: models.RolePermission,
              as: "RolePermission",
              required: false,
              attributes: ["moduleId", "permission"],
            },
          ],
        },
      ],
    });
  },

  createUser: async (userData, transaction = null) => {
    return models.User.create(userData, { transaction });
  },

  saveRefreshToken: async (tokenData) => {
    // Delete existing refresh tokens for this user
    await models.AuthToken.destroy({
      where: { user_id: tokenData.user_id },
    });
    // Create new refresh token
    return models.AuthToken.create(tokenData);
  },

  findRefreshToken: async (token) => {
    return models.AuthToken.findOne({
      where: { token },
    });
  },

  deleteRefreshToken: async (token) => {
    return models.AuthToken.destroy({
      where: { token },
    });
  },

  deleteAllUserRefreshTokens: async (userId) => {
    return models.AuthToken.destroy({
      where: { user_id: userId },
    });
  },
};

export default repo;

