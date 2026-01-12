import { QueryInterface, DataTypes } from 'sequelize';


export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn("Requisitions", "finalPrice", {
      type: DataTypes.DOUBLE,
      after: "totalPrice",
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn("Requisitions", "finalPrice");
  },
};
