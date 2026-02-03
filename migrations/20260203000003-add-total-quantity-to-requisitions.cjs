'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add totalQuantity column to Requisitions table
    await queryInterface.addColumn('Requisitions', 'totalQuantity', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove totalQuantity column from Requisitions table
    await queryInterface.removeColumn('Requisitions', 'totalQuantity');
  },
};
