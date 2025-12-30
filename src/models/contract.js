import { Model, DataTypes } from "sequelize";

const statusEnum = [
  "Created",
  "Opened",
  "Completed",
  "Verified",
  "Accepted",
  "Rejected",
  "Expired",
  "InitialQuotation",
];

const contractModel = (sequelize) => {
  class Contract extends Model {
    static associate(models) {
      this.belongsTo(models.Requisition, {
        foreignKey: "requisitionId",
        as: "Requisition",
      });
      this.belongsTo(models.User, {
        foreignKey: "vendorId",
        as: "Vendor",
      });
      this.belongsTo(models.Company, {
        foreignKey: "companyId",
        as: "Company",
      });
      this.hasMany(models.Po, { foreignKey: "contractId", as: "PurchaseOrders" });
    }
  }

  Contract.init(
    {
      companyId: DataTypes.INTEGER,
      requisitionId: DataTypes.INTEGER,
      vendorId: DataTypes.INTEGER,
      status: {
        type: DataTypes.ENUM(...statusEnum),
        defaultValue: "Created",
      },
      uniqueToken: DataTypes.STRING,
      contractDetails: DataTypes.TEXT,
      finalContractDetails: DataTypes.TEXT,
      openedAt: DataTypes.DATE,
      completedAt: DataTypes.DATE,
      verifiedAt: DataTypes.DATE,
      acceptedAt: DataTypes.DATE,
      rejectedAt: DataTypes.DATE,
      createdBy: DataTypes.INTEGER,
      updatedBy: DataTypes.INTEGER,
      quotedAt: DataTypes.DATE,
      benchmarkRating: DataTypes.DOUBLE(5, 2),
      finalRating: DataTypes.DOUBLE(5, 2),
      chatbotDealId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "Reference to the deal ID in the chatbot system",
      },
    },
    {
      sequelize,
      tableName: "Contracts",
      timestamps: true,
      underscored: false,
      updatedAt: false,
    }
  );

  return Contract;
};

export default contractModel;

