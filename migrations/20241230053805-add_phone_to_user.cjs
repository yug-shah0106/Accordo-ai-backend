"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("User", "phone", {
      type: Sequelize.STRING,
      after: "email",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("User", "phone");
  },
};
