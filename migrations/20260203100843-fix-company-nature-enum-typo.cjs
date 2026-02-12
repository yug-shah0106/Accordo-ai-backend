'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add the correct 'International' value to the enum
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Companies_nature" ADD VALUE IF NOT EXISTS 'International';
    `);

    // Update any existing rows that have the typo
    await queryInterface.sequelize.query(`
      UPDATE "Companies" SET "nature" = 'International' WHERE "nature" = 'Interational';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing enum values easily
    // We can only revert the data change
    await queryInterface.sequelize.query(`
      UPDATE "Companies" SET "nature" = 'Interational' WHERE "nature" = 'International';
    `);
  }
};
