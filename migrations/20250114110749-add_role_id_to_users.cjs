"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("User", "roleId", {
      type: Sequelize.INTEGER,
      after: "companyId",
      references: {
        model: "Roles",
        key: "id",
      },
    });
    await queryInterface.addColumn("User", "status", {
      type: Sequelize.STRING,
      after: "roleId",
      defaultValue: "active",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("User", "status");
    await queryInterface.removeColumn("User", "roleId");
  },
};
