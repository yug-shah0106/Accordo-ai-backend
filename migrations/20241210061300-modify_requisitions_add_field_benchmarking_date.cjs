"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("Requisitions");
    if (!table.benchmarkingDate) {
      await queryInterface.addColumn("Requisitions", "benchmarkingDate", {
        type: Sequelize.DATE,
        after: "benchmarkedAt",
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("Requisitions");
    if (table.benchmarkingDate) {
      await queryInterface.removeColumn("Requisitions", "benchmarkingDate");
    }
  },
};
