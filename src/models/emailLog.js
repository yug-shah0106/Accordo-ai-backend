import { Model, DataTypes } from "sequelize";

const emailStatusEnum = ["pending", "sent", "failed", "bounced"];
const emailTypeEnum = ["vendor_attached", "status_change", "reminder", "other"];

const emailLogModel = (sequelize) => {
  class EmailLog extends Model {
    static associate(models) {
      this.belongsTo(models.User, {
        foreignKey: "recipientId",
        as: "Recipient",
      });
      this.belongsTo(models.Contract, {
        foreignKey: "contractId",
        as: "Contract",
      });
      this.belongsTo(models.Requisition, {
        foreignKey: "requisitionId",
        as: "Requisition",
      });
    }
  }

  EmailLog.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      recipientEmail: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      recipientId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      subject: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      emailType: {
        type: DataTypes.ENUM(...emailTypeEnum),
        allowNull: false,
        defaultValue: "other",
      },
      status: {
        type: DataTypes.ENUM(...emailStatusEnum),
        allowNull: false,
        defaultValue: "pending",
      },
      contractId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      requisitionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: "Additional email metadata (old status, new status, etc.)",
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      retryCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      messageId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "SMTP message ID for tracking",
      },
    },
    {
      sequelize,
      tableName: "EmailLogs",
      timestamps: true,
      indexes: [
        { fields: ["recipientEmail"] },
        { fields: ["status"] },
        { fields: ["emailType"] },
        { fields: ["contractId"] },
        { fields: ["requisitionId"] },
        { fields: ["createdAt"] },
      ],
    }
  );

  return EmailLog;
};

export default emailLogModel;
