"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Products", "gstPercentage", {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: "gstType",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Products", "gstPercentage");
  },
};
