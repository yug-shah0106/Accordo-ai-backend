import { Model, DataTypes } from "sequelize";

export default function rolePermissionModel(sequelize) {
  class RolePermission extends Model {
    static associate(models) {
      this.belongsTo(models.Role, {
        foreignKey: "roleId",
        as: "Role",
      });
      this.belongsTo(models.Module, {
        foreignKey: "moduleId",
        as: "Module",
      });
    }
  }

  RolePermission.init(
    {
      roleId: DataTypes.INTEGER,
      moduleId: DataTypes.INTEGER,
      permission: DataTypes.INTEGER,
    },
    {
      sequelize,
      tableName: "RolePermissions",
      timestamps: true,
      underscored: false,
      updatedAt: false,
    }
  );

  return RolePermission;
}
