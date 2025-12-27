"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add BATNA and discountedValue fields to Requisitions table
    await queryInterface.addColumn("Requisitions", "batna", {
      type: Sequelize.DOUBLE,
      allowNull: true,
      comment: "Best Alternative To a Negotiated Agreement - target price for negotiation",
    });

    await queryInterface.addColumn("Requisitions", "discountedValue", {
      type: Sequelize.DOUBLE,
      allowNull: true,
      comment: "Current discounted value achieved through negotiation",
    });

    await queryInterface.addColumn("Requisitions", "maxDiscount", {
      type: Sequelize.DOUBLE,
      allowNull: true,
      comment: "Maximum discount percentage acceptable",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Requisitions", "batna");
    await queryInterface.removeColumn("Requisitions", "discountedValue");
    await queryInterface.removeColumn("Requisitions", "maxDiscount");
  },
};




