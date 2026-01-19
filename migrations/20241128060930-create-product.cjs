import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable("Products", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      productName: {
        type: DataTypes.STRING,
      },
      category: {
        type: DataTypes.STRING,
      },
      brandName: {
        type: DataTypes.STRING,
      },
      gstType: {
        type: DataTypes.ENUM("GST", "Non-GST"),
      },
      tds: {
        type: DataTypes.DOUBLE,
      },
      type: {
        type: DataTypes.ENUM("Goods", "Services"),
        defaultValue: "Goods",
      },
      UOM: {
        type: DataTypes.STRING,
      },
      companyId: {
        type: DataTypes.INTEGER,
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: DataTypes.DATE,
      },
    });
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable("Products");
  },
};
