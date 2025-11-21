import { Model, DataTypes } from "sequelize";

const userTypeEnum = ["admin", "customer", "vendor"];

const userModel = (sequelize) => {
  class User extends Model {
    static associate(models) {
      this.belongsTo(models.Company, {
        foreignKey: "companyId",
        as: "Company",
      });
      this.belongsTo(models.Role, {
        foreignKey: "roleId",
        as: "Role",
      });
      this.belongsTo(models.RolePermission, {
        foreignKey: "roleId",
        targetKey: "roleId",
        as: "RolePermission",
        constraints: false,
      });
      this.hasMany(models.Contract, {
        foreignKey: "vendorId",
        as: "Contract",
      });
      this.hasMany(models.Otp, {
        foreignKey: "user_id",
        as: "Otp",
      });
      this.hasMany(models.UserAction, {
        foreignKey: "userId",
        as: "Actions",
      });
      this.hasMany(models.Po, {
        foreignKey: "vendorId",
        as: "PurchaseOrders",
      });
      this.hasMany(models.Po, {
        foreignKey: "addedBy",
        as: "CreatedPurchaseOrders",
      });
    }
  }

  User.init(
    {
      name: DataTypes.STRING,
      profilePic: DataTypes.STRING,
      email: {
        type: DataTypes.STRING,
        unique: true,
      },
      phone: DataTypes.STRING,
      password: DataTypes.STRING,
      userType: {
        type: DataTypes.ENUM(...userTypeEnum),
        defaultValue: "customer",
      },
      companyId: DataTypes.INTEGER,
      roleId: DataTypes.INTEGER,
      status: {
        type: DataTypes.STRING,
        defaultValue: "active",
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: "User",
      timestamps: true,
      underscored: false,
      defaultScope: {
        attributes: { exclude: ["password"] },
      },
      scopes: {
        withPassword: {
          attributes: {},
        },
      },
    }
  );

  return User;
};

export default userModel;

