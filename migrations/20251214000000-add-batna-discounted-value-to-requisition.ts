import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    // Add BATNA and discountedValue fields to Requisitions table
    await queryInterface.addColumn("Requisitions", "batna", {
      type: DataTypes.DOUBLE,
      allowNull: true,
      comment: "Best Alternative To a Negotiated Agreement - target price for negotiation",
    });

    await queryInterface.addColumn("Requisitions", "discountedValue", {
      type: DataTypes.DOUBLE,
      allowNull: true,
      comment: "Current discounted value achieved through negotiation",
    });

    await queryInterface.addColumn("Requisitions", "maxDiscount", {
      type: DataTypes.DOUBLE,
      allowNull: true,
      comment: "Maximum discount percentage acceptable",
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn("Requisitions", "batna");
    await queryInterface.removeColumn("Requisitions", "discountedValue");
    await queryInterface.removeColumn("Requisitions", "maxDiscount");
  },
};
