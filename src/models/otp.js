import { Model, DataTypes } from "sequelize";

const otpModel = (sequelize) => {
  class Otp extends Model {
    static associate(models) {
      this.belongsTo(models.User, {
        foreignKey: "user_id",
        as: "User",
      });
    }
  }

  Otp.init(
    {
      user_id: DataTypes.INTEGER,
      otp: DataTypes.STRING,
      for: DataTypes.STRING,
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: "Otps",
      timestamps: false,
    }
  );

  return Otp;
};

export default otpModel;

