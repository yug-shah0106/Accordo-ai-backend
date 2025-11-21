import { Model, DataTypes } from "sequelize";

const natureEnum = ["Domestic", "Interational"];
const employeesEnum = ["0-10", "10-100", "100-1000", "1000+"];
const industryEnum = ["Industry1", "Industry2"];
const currencyEnum = ["INR", "USD", "EUR"];

const companyModel = (sequelize) => {
  class Company extends Model {
    static associate(models) {
      this.hasMany(models.User, { foreignKey: "companyId", as: "Users" });
      this.hasMany(models.User, { foreignKey: "companyId", as: "Vendor" });
      this.hasMany(models.Po, { foreignKey: "companyId", as: "Po" });
      this.hasMany(models.Project, { foreignKey: "companyId", as: "Project" });
      this.hasMany(models.VendorCompany, {
        foreignKey: "companyId",
        as: "VendorCompanies",
      });
      this.hasMany(models.VendorCompany, {
        foreignKey: "companyId",
        as: "vendorCompany",
      });
    }
  }

  Company.init(
    {
      companyName: DataTypes.STRING,
      companyLogo: DataTypes.STRING,
      apiKey: DataTypes.STRING(150),
      apiSecret: DataTypes.STRING(150),
      establishmentDate: DataTypes.DATE,
      nature: DataTypes.ENUM(...natureEnum),
      type: DataTypes.STRING(150),
      numberOfEmployees: DataTypes.ENUM(...employeesEnum),
      annualTurnover: DataTypes.STRING,
      industryType: DataTypes.ENUM(...industryEnum),
      gstNumber: DataTypes.STRING(100),
      gstFileUrl: DataTypes.STRING,
      panNumber: DataTypes.STRING(100),
      panFileUrl: DataTypes.STRING,
      msmeNumber: DataTypes.STRING(100),
      msmeFileUrl: DataTypes.STRING,
      ciNumber: DataTypes.STRING(100),
      ciFileUrl: DataTypes.STRING,
      pocName: DataTypes.STRING(100),
      pocDesignation: DataTypes.STRING(100),
      pocEmail: DataTypes.STRING(100),
      pocPhone: DataTypes.STRING(20),
      pocWebsite: DataTypes.STRING,
      escalationName: DataTypes.STRING(100),
      escalationDesignation: DataTypes.STRING(100),
      escalationEmail: DataTypes.STRING(100),
      escalationPhone: DataTypes.STRING(20),
      typeOfCurrency: DataTypes.ENUM(...currencyEnum),
      bankName: DataTypes.STRING(100),
      beneficiaryName: DataTypes.STRING(100),
      accountNumber: DataTypes.STRING(20),
      iBanNumber: DataTypes.STRING(34),
      swiftCode: DataTypes.STRING(11),
      bankAccountType: DataTypes.STRING(50),
      cancelledCheque: DataTypes.STRING,
      cancelledChequeURL: DataTypes.STRING,
      ifscCode: DataTypes.STRING(11),
      taxInPercentage: DataTypes.DOUBLE(5, 2),
      fullAddress: DataTypes.STRING,
      createdBy: DataTypes.INTEGER,
    },
    {
      sequelize,
      tableName: "Companies",
      timestamps: true,
      underscored: false,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return Company;
};

export default companyModel;

