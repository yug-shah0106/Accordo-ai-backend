"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("User", "profilePic", {
      type: Sequelize.STRING,
      after: "name",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("User", "profilePic");
  },
};
