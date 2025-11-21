"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Contracts", "finalRating", {
      type: Sequelize.DOUBLE(5, 2),
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Contracts", "finalRating");
  },
};
