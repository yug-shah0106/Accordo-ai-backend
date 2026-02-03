'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add totalMaxPrice column to Requisitions table
    await queryInterface.addColumn('Requisitions', 'totalMaxPrice', {
      type: Sequelize.DOUBLE,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove totalMaxPrice column from Requisitions table
    await queryInterface.removeColumn('Requisitions', 'totalMaxPrice');
  },
};
