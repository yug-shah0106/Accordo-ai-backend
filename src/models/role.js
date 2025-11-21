import { Model, DataTypes } from "sequelize";

const roleModel = (sequelize) => {
  class Role extends Model {
    static associate(models) {
      this.hasMany(models.RolePermission, {
        foreignKey: "roleId",
        as: "RolePermission",
      });
      this.belongsTo(models.User, {
        foreignKey: "createdBy",
        as: "Creator",
      });
      this.belongsTo(models.User, {
        foreignKey: "updatedBy",
        as: "Updator",
      });
      this.hasMany(models.User, {
        foreignKey: "roleId",
        as: "Users",
      });
    }
  }

  Role.init(
    {
      name: DataTypes.STRING,
      createdBy: DataTypes.INTEGER,
      companyId: DataTypes.INTEGER,
      updatedBy: DataTypes.INTEGER,
      isArchived: DataTypes.BOOLEAN,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: "Roles",
      timestamps: true,
      underscored: false,
      updatedAt: false,
    }
  );

  return Role;
};

export default roleModel;

