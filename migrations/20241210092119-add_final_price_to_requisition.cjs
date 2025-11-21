"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Requisitions", "finalPrice", {
      type: Sequelize.DOUBLE,
      after: "totalPrice",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Requisitions", "finalPrice");
  },
};
