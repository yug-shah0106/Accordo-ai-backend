"use strict";
import { Model, DataTypes } from "sequelize";

const requisitionProductModel = (sequelize) => {
  class RequisitionProduct extends Model {
    static associate(models) {
      this.belongsTo(models.Requisition, {
        foreignKey: "requisitionId",
        as: "Requisition",
      });
      this.belongsTo(models.Product, {
        foreignKey: "productId",
        as: "Product",
      });
    }
  }

  RequisitionProduct.init(
    {
      requisitionId: DataTypes.INTEGER,
      productId: DataTypes.INTEGER,
      targetPrice: DataTypes.DOUBLE,
      maximum_price: DataTypes.DOUBLE,
      qty: DataTypes.INTEGER,
      createdBy: DataTypes.INTEGER,
    },
    {
      sequelize,
      tableName: "RequisitionProducts",
      timestamps: true,
      underscored: false,
      updatedAt: false,
    }
  );

  return RequisitionProduct;
};

export default requisitionProductModel;

