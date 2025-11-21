"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Contracts", "finalContractDetails", {
      type: Sequelize.TEXT,
      after: "contractDetails",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Contracts", "finalContractDetails");
  },
};
