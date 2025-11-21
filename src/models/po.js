import { Model, DataTypes } from "sequelize";

const statusEnum = ["Created", "Cancelled"];

const poModel = (sequelize) => {
  class Po extends Model {
    static associate(models) {
      this.belongsTo(models.Contract, {
        foreignKey: "contractId",
        as: "Contract",
      });
      this.belongsTo(models.Requisition, {
        foreignKey: "requisitionId",
        as: "Requisition",
      });
      this.belongsTo(models.Company, {
        foreignKey: "companyId",
        as: "Company",
      });
      this.belongsTo(models.User, {
        foreignKey: "addedBy",
        as: "Creator",
      });
      this.belongsTo(models.User, {
        foreignKey: "vendorId",
        as: "Vendor",
      });
    }
  }

  Po.init(
    {
      contractId: DataTypes.INTEGER,
      requisitionId: DataTypes.INTEGER,
      companyId: DataTypes.INTEGER,
      vendorId: DataTypes.INTEGER,
      lineItems: DataTypes.STRING,
      subTotal: DataTypes.DOUBLE,
      taxTotal: DataTypes.DOUBLE,
      total: DataTypes.DOUBLE,
      deliveryDate: DataTypes.DATE,
      paymentTerms: DataTypes.STRING,
      status: DataTypes.ENUM(...statusEnum),
      poNumber: DataTypes.STRING,
      poUrl: DataTypes.STRING,
      addedBy: DataTypes.INTEGER,
    },
    {
      sequelize,
      tableName: "Pos",
      timestamps: true,
      underscored: false,
      updatedAt: false,
    }
  );

  return Po;
};

export default poModel;

