'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add GBP and AUD to the typeOfCurrency enum
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Requisitions_typeOfCurrency" ADD VALUE IF NOT EXISTS 'GBP';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Requisitions_typeOfCurrency" ADD VALUE IF NOT EXISTS 'AUD';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing values from enums easily
    // This would require recreating the enum type and updating the column
    // For safety, we'll leave this as a no-op
    console.log('Downgrade not supported for enum value removal');
  },
};
