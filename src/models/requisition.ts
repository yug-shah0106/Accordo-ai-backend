import {
  Model,
  DataTypes,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
  ModelStatic,
  NonAttribute,
} from 'sequelize';

const currencyEnum = ['USD', 'INR', 'EUR'] as const;
const statusEnum = [
  'Draft',
  'Created',
  'Fulfilled',
  'Benchmarked',
  'InitialQuotation',
  'Closed',
  'Awarded',
  'Cancelled',
  'Expired',
  'NegotiationStarted',
] as const;

export type RequisitionCurrency = (typeof currencyEnum)[number];
export type RequisitionStatus = (typeof statusEnum)[number];

export class Requisition extends Model<
  InferAttributes<Requisition>,
  InferCreationAttributes<Requisition>
> {
  declare id: CreationOptional<number>;
  declare projectId: ForeignKey<number>;
  declare rfqId: string | null;
  declare subject: string | null;
  declare category: string | null;
  declare deliveryDate: Date | null;
  declare negotiationClosureDate: Date | null;
  declare typeOfCurrency: RequisitionCurrency | null;
  declare totalPrice: number | null;
  declare finalPrice: number | null;
  declare status: RequisitionStatus | null;
  declare savingsInPrice: number | null;
  declare createdBy: number | null;
  declare fulfilledAt: Date | null;
  declare fulfilledBy: number | null;
  declare benchmarkedAt: Date | null;
  declare benchmarkingDate: Date | null;
  declare benchmarkedBy: number | null;
  declare benchmarkResponse: string | null;
  declare payment_terms: string | null;
  declare net_payment_day: string | null;
  declare pre_payment_percentage: number | null;
  declare post_payment_percentage: number | null;
  declare maxDeliveryDate: Date | null;
  declare pricePriority: string | null;
  declare deliveryPriority: string | null;
  declare paymentTermsPriority: string | null;
  declare batna: number | null;
  declare discountedValue: number | null;
  declare maxDiscount: number | null;
  declare createdAt: CreationOptional<Date>;

  // Associations
  declare RequisitionProduct?: NonAttribute<any[]>;

  static associate(models: Record<string, typeof Model>): void {
    this.belongsTo(models.Project as ModelStatic<Model>, {
      foreignKey: 'projectId',
      as: 'Project',
    });
    this.hasMany(models.Contract as ModelStatic<Model>, {
      foreignKey: 'requisitionId',
      as: 'Contract',
    });
    this.hasMany(models.RequisitionProduct as ModelStatic<Model>, {
      foreignKey: 'requisitionId',
      as: 'RequisitionProduct',
    });
    this.hasMany(models.RequisitionAttachment as ModelStatic<Model>, {
      foreignKey: 'requisitionId',
      as: 'RequisitionAttachment',
    });
    this.hasMany(models.Po as ModelStatic<Model>, {
      foreignKey: 'requisitionId',
      as: 'PurchaseOrders',
    });
  }
}

export default function requisitionModel(sequelize: Sequelize): typeof Requisition {
  Requisition.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
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
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'Requisitions',
      timestamps: true,
      underscored: false,
      updatedAt: false,
    }
  );

  Requisition.beforeCreate(async (requisition: Requisition) => {
    if (!requisition.rfqId) {
      const last = await Requisition.findOne({
        order: [['createdAt', 'DESC']],
      });

      let next = 1;
      if (last?.rfqId) {
        const parsed = parseInt(last.rfqId.replace('RFQ', ''), 10);
        if (!Number.isNaN(parsed)) {
          next = parsed + 1;
        }
      }

      requisition.rfqId = `RFQ${String(next).padStart(4, '0')}`;
    }
  });

  return Requisition;
}
