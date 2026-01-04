import models, { sequelize } from "../../models/index.js";
import type { Transaction } from "sequelize";

/**
 * Interface for role data
 */
interface RoleData {
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: number;
  updatedBy?: number;
  companyId?: number;
  isArchived?: boolean;
  [key: string]: unknown;
}

/**
 * Interface for role permission data
 */
interface RolePermissionData {
  roleId: number;
  moduleId: number;
  permission: number;
}

/**
 * Interface for update role data
 */
interface UpdateRoleData {
  name: string;
  updatedAt: Date;
  updatedBy: number;
}

/**
 * Interface for role with permissions
 */
interface RoleWithPermissions {
  id: number;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
  Creator?: { name: string };
  Updator?: { name: string };
  RolePermission?: Array<{ permission: number }>;
  permissions?: number[];
  toJSON: () => {
    id: number;
    name: string;
    createdAt?: Date;
    updatedAt?: Date;
    Creator?: { name: string };
    Updator?: { name: string };
    RolePermission: Array<{ permission: number }>;
    [key: string]: unknown;
  };
}

/**
 * Role repository with database operations
 */
const repo = {
  /**
   * Create a new role
   */
  createRole: async (roleData: RoleData): Promise<any> => {
    return models.Role.create(roleData);
  },

  /**
   * Get all roles for a company with permissions
   */
  getRoles: async (companyId: number): Promise<unknown[]> => {
    const roles = (await models.Role.findAll({
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
    })) as RoleWithPermissions[];

    return roles.map((role) => {
      const data = role.toJSON();
      return {
        ...data,
        permissions: data.RolePermission.map((p) => p.permission),
        RolePermission: undefined,
      };
    });
  },

  /**
   * Get a role by a specific field
   */
  getRoleWhere: async (filterBy: string, filterValue: unknown): Promise<any> => {
    return models.Role.findOne({ where: { [filterBy]: filterValue } });
  },

  /**
   * Get a single role by ID with permissions
   */
  getRole: async (roleId: string): Promise<any> => {
    return models.Role.findByPk(roleId, {
      attributes: ["id", "name"],
      include: {
        model: models.RolePermission,
        as: "RolePermission",
      },
    });
  },

  /**
   * Update a role and its permissions in a transaction
   */
  updateRole: async (
    roleId: string,
    roleData: UpdateRoleData,
    newPermissions: RolePermissionData[]
  ): Promise<void> => {
    const transaction: Transaction = await sequelize.transaction();
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

  /**
   * Get role permission by role ID
   */
  getRolePermission: async (roleId: number): Promise<any> => {
    return models.RolePermission.findOne({ where: { roleId } });
  },

  /**
   * Create multiple role permissions
   */
  createRolePermission: async (permissionData: RolePermissionData[]): Promise<any[]> => {
    return models.RolePermission.bulkCreate(permissionData);
  },

  /**
   * Update role permissions
   */
  updateRolePermission: async (
    roleId: number,
    permissionData: Partial<RolePermissionData>
  ): Promise<[affectedCount: number]> => {
    return models.RolePermission.update(permissionData, {
      where: { roleId },
    });
  },

  /**
   * Delete (archive) a role
   */
  deleteRole: async (roleId: string): Promise<[affectedCount: number]> => {
    return models.Role.update(
      { isArchived: true },
      { where: { id: roleId } }
    );
  },
};

export default repo;
