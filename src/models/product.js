import { Model, DataTypes } from "sequelize";

const gstTypeEnum = ["GST", "Non-GST"];

const productModel = (sequelize) => {
  class Product extends Model {
    static associate(models) {
      this.belongsTo(models.Company, {
        foreignKey: "companyId",
        as: "Company",
      });
      this.hasMany(models.RequisitionProduct, {
        foreignKey: "productId",
        as: "RequisitionProducts",
      });
    }
  }

  Product.init(
    {
      productName: DataTypes.STRING,
      category: DataTypes.STRING,
      brandName: DataTypes.STRING,
      gstType: DataTypes.ENUM(...gstTypeEnum),
      gstPercentage: DataTypes.INTEGER,
      tds: DataTypes.DOUBLE,
      type: DataTypes.STRING,
      UOM: DataTypes.STRING,
      companyId: DataTypes.INTEGER,
    },
    {
      sequelize,
      tableName: "Products",
      timestamps: true,
      underscored: false,
    }
  );

  return Product;
};

export default productModel;

