import { Model, DataTypes } from "sequelize";

export default function vendorCompanyModel(sequelize) {
  class VendorCompany extends Model {
    static associate(models) {
      this.belongsTo(models.User, {
        foreignKey: "vendorId",
        as: "Vendor",
      });
      this.belongsTo(models.Company, {
        foreignKey: "companyId",
        as: "Company",
      });
    }
  }

  VendorCompany.init(
    {
      vendorId: DataTypes.INTEGER,
      companyId: DataTypes.INTEGER,
    },
    {
      sequelize,
      tableName: "VendorCompanies",
      timestamps: true,
      underscored: false,
      updatedAt: false,
    }
  );

  return VendorCompany;
}
