import models, { sequelize } from "../../models/index.js";
import CustomError from "../../utils/custom-error.js";

const repo = {
  createRole: async (roleData) => {
    return models.Role.create(roleData);
  },

  getRoles: async (companyId) => {
    const roles = await models.Role.findAll({
      where: { companyId, isArchived: false },
      attributes: ["id", "name", "createdAt", "updatedAt"],
      include: [
        {
          model: models.User,
          as: "Creator",
          attributes: ["name"],
        },
        {
          model: models.User,
          as: "Updator",
          attributes: ["name"],
        },
        {
          model: models.RolePermission,
          as: "RolePermission",
          attributes: ["permission"],
        },
      ],
    });
    return roles.map((role) => {
      const data = role.toJSON();
      return {
        ...data,
        permissions: data.RolePermission.map((p) => p.permission),
        RolePermission: undefined,
      };
    });
  },

  getRoleWhere: async (filterBy, filterValue) => {
    return models.Role.findOne({ where: { [filterBy]: filterValue } });
  },

  getRole: async (roleId) => {
    return models.Role.findByPk(roleId, {
      attributes: ["id", "name"],
      include: {
        model: models.RolePermission,
        as: "RolePermission",
      },
    });
  },

  updateRole: async (roleId, roleData, newPermissions) => {
    const transaction = await sequelize.transaction();
    try {
      await models.Role.update(roleData, { where: { id: roleId }, transaction });
      await models.RolePermission.destroy({ where: { roleId }, transaction });
      await models.RolePermission.bulkCreate(newPermissions, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  getRolePermission: async (roleId) => {
    return models.RolePermission.findOne({ where: { roleId } });
  },

  createRolePermission: async (permissionData) => {
    return models.RolePermission.bulkCreate(permissionData);
  },

  updateRolePermission: async (roleId, permissionData) => {
    return models.RolePermission.update(permissionData, {
      where: { roleId },
    });
  },

  deleteRole: async (roleId) => {
    return models.Role.update(
      { isArchived: true },
      { where: { id: roleId } }
    );
  },
};

export default repo;

