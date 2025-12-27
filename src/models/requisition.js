import { Model, DataTypes } from "sequelize";

const currencyEnum = ["USD", "INR", "EUR"];
const statusEnum = [
  "Draft",
  "Created",
  "Fulfilled",
  "Benchmarked",
  "InitialQuotation",
  "Closed",
  "Awarded",
  "Cancelled",
  "Expired",
  "NegotiationStarted",
];

const requisitionModel = (sequelize) => {
  class Requisition extends Model {
    static associate(models) {
      this.belongsTo(models.Project, {
        foreignKey: "projectId",
        as: "Project",
      });
      this.hasMany(models.Contract, {
        foreignKey: "requisitionId",
        as: "Contract",
      });
      this.hasMany(models.RequisitionProduct, {
        foreignKey: "requisitionId",
        as: "RequisitionProduct",
      });
      this.hasMany(models.RequisitionAttachment, {
        foreignKey: "requisitionId",
        as: "RequisitionAttachment",
      });
      this.hasMany(models.Po, {
        foreignKey: "requisitionId",
        as: "PurchaseOrders",
      });
    }
  }

  Requisition.init(
    {
      projectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      rfqId: {
        type: DataTypes.STRING,
        unique: true,
      },
      subject: DataTypes.STRING,
      category: DataTypes.STRING,
      deliveryDate: DataTypes.DATE,
      negotiationClosureDate: DataTypes.DATE,
      typeOfCurrency: DataTypes.ENUM(...currencyEnum),
      totalPrice: DataTypes.DOUBLE,
      finalPrice: DataTypes.DOUBLE,
      status: DataTypes.ENUM(...statusEnum),
      savingsInPrice: DataTypes.DOUBLE,
      createdBy: DataTypes.INTEGER,
      fulfilledAt: DataTypes.DATE,
      fulfilledBy: DataTypes.INTEGER,
      benchmarkedAt: DataTypes.DATE,
      benchmarkingDate: DataTypes.DATE,
      benchmarkedBy: DataTypes.INTEGER,
      benchmarkResponse: DataTypes.TEXT,
      payment_terms: DataTypes.STRING,
      net_payment_day: DataTypes.STRING,
      pre_payment_percentage: DataTypes.DOUBLE,
      post_payment_percentage: DataTypes.DOUBLE,
      maxDeliveryDate: DataTypes.DATE,
      pricePriority: DataTypes.STRING,
      deliveryPriority: DataTypes.STRING,
      paymentTermsPriority: DataTypes.STRING,
      batna: DataTypes.DOUBLE,
      discountedValue: DataTypes.DOUBLE,
      maxDiscount: DataTypes.DOUBLE,
    },
    {
      sequelize,
      tableName: "Requisitions",
      timestamps: true,
      underscored: false,
      updatedAt: false,
    }
  );

  Requisition.beforeCreate(async (requisition) => {
    if (!requisition.rfqId) {
      const last = await Requisition.findOne({
        order: [["createdAt", "DESC"]],
      });

      let next = 1;
      if (last?.rfqId) {
        const parsed = parseInt(last.rfqId.replace("RFQ", ""), 10);
        if (!Number.isNaN(parsed)) {
          next = parsed + 1;
        }
      }

      requisition.rfqId = `RFQ${String(next).padStart(4, "0")}`;
    }
  });

  return Requisition;
};

export default requisitionModel;

