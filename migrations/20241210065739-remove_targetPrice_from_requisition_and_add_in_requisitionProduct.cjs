"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Requisitions", "targetPrice");
    await queryInterface.addColumn("RequisitionProducts", "targetPrice", {
      type: Sequelize.DOUBLE,
      after: "productId",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("RequisitionProducts", "targetPrice");
  },
};
