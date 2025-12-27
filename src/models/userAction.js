"use strict";
import { Model, DataTypes } from "sequelize";

const userActionModel = (sequelize) => {
  class UserAction extends Model {
    static associate(models) {
      this.belongsTo(models.User, {
        foreignKey: "userId",
        as: "User",
      });
    }
  }

  UserAction.init(
    {
      userId: DataTypes.INTEGER,
      moduleName: DataTypes.STRING,
      action: DataTypes.STRING,
    },
    {
      sequelize,
      tableName: "UserActions",
      timestamps: true,
      underscored: false,
      updatedAt: false,
    }
  );

  return UserAction;
};

export default userActionModel;

