import { Op } from "sequelize";
import models, { sequelize } from "../../models/index.js";

/**
 * Interface for query options
 */
interface QueryOptions {
  where?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  include?: unknown[];
  having?: unknown;
  role?: string;
  [key: string]: unknown;
}

/**
 * Interface for find and count result
 */
interface FindAndCountResult {
  rows: unknown[];
  count: number;
}

/**
 * User repository with database operations
 */
const repo = {
  /**
   * Get user profile by user ID
   */
  getUserProfile: async (userId: number): Promise<any> => {
    return models.User.findOne({ where: { id: userId } });
  },

  /**
   * Assign a role to a user
   */
  assignRole: async (userId: number, roleId: number): Promise<[affectedCount: number]> => {
    return models.User.update({ roleId }, { where: { id: userId } });
  },

  /**
   * Get all users with filtering and pagination
   */
  getAllUsers: async (queryOptions: QueryOptions = {}): Promise<FindAndCountResult> => {
    const { searchTerm, ...restOptions } = queryOptions as QueryOptions & { searchTerm?: string };

    // Build Role include with optional name search
    const roleInclude: any = {
      model: models.Role,
      as: "Role",
    };

    // If searching by term, also search role name
    if (searchTerm) {
      roleInclude.where = {
        name: { [Op.iLike]: `%${searchTerm}%` },
      };
      roleInclude.required = false; // Make it optional so users without matching roles still appear if they match other fields
    }

    const options: any = {
      ...restOptions,
      include: [roleInclude],
      order: [['id', 'ASC']], // Sort by ID to maintain consistent ordering
    };
    if (queryOptions.role) {
      options.having = sequelize.literal(
        `"Role"."name" = '${queryOptions.role}'`
      );
    }
    return models.User.findAndCountAll(options);
  },

  /**
   * Get a single user by ID with role and permissions
   */
  getUser: async (userId: number | string): Promise<any> => {
    return models.User.findByPk(userId, {
      include: [
        {
          model: models.Role,
          as: "Role",
          include: [
            {
              model: models.RolePermission,
              as: "RolePermission",
            },
          ],
        },
      ],
    });
  },

  /**
   * Update user information
   */
  updateUser: async (
    userId: number | string,
    userData: Record<string, unknown>
  ): Promise<[affectedCount: number]> => {
    return models.User.update(userData, { where: { id: userId } });
  },

  /**
   * Delete a user by ID
   */
  deleteUser: async (userId: number | string): Promise<number> => {
    return models.User.destroy({ where: { id: userId } });
  },
};

export default repo;
