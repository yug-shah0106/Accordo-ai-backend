import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable("RequisitionProducts", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      requisitionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Requisitions",
          key: "id",
        },
      },
      productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Products",
          key: "id",
        },
      },
      qty: {
        type: DataTypes.INTEGER,
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "User",
          key: "id",
        },
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE,
      },
    });
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable("RequisitionProducts");
  },
};
