"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Contracts", "chatbotDealId", {
      type: Sequelize.UUID,
      allowNull: true,
      comment: "Reference to the deal ID in the chatbot system",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Contracts", "chatbotDealId");
  },
};
