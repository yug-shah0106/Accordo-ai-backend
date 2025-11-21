import { Model, DataTypes } from "sequelize";

const moduleModel = (sequelize) => {
  class Module extends Model {
    static associate(models) {
      this.hasMany(models.RolePermission, {
        foreignKey: "moduleId",
        as: "RolePermissions",
      });
    }
  }

  Module.init(
    {
      name: DataTypes.STRING,
      isArchived: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      tableName: "Modules",
      timestamps: true,
      updatedAt: false,
    }
  );

  return Module;
};

export default moduleModel;

