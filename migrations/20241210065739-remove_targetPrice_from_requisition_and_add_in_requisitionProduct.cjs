import { QueryInterface, DataTypes } from 'sequelize';


export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn("Requisitions", "targetPrice");
    await queryInterface.addColumn("RequisitionProducts", "targetPrice", {
      type: DataTypes.DOUBLE,
      after: "productId",
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn("RequisitionProducts", "targetPrice");
  },
};
