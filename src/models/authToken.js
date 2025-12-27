import { Model, DataTypes } from "sequelize";

export default function authTokenModel(sequelize) {
  class AuthToken extends Model {
    static associate(models) {
      this.belongsTo(models.User, {
        foreignKey: "user_id",
        as: "User",
        constraints: false,
      });
    }
  }

  AuthToken.init(
    {
      user_id: DataTypes.INTEGER,
      token: DataTypes.STRING,
      email: DataTypes.STRING,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: "authTokens",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return AuthToken;
}

