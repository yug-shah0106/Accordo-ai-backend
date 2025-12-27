"use strict";
import { Model, DataTypes } from "sequelize";

const requisitionAttachmentModel = (sequelize) => {
  class RequisitionAttachment extends Model {
    static associate(models) {
      this.belongsTo(models.Requisition, {
        foreignKey: "requisitionId",
        as: "Requisition",
      });
      this.belongsTo(models.User, {
        foreignKey: "createdBy",
        as: "Creator",
      });
    }
  }

  RequisitionAttachment.init(
    {
      requisitionId: DataTypes.INTEGER,
      attachmentUrl: DataTypes.STRING,
      createdBy: DataTypes.INTEGER,
    },
    {
      sequelize,
      tableName: "RequisitionAttachments",
      timestamps: true,
      underscored: false,
      updatedAt: false,
    }
  );

  return RequisitionAttachment;
};

export default requisitionAttachmentModel;

