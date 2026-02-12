'use strict';

/**
 * Migration: Add 'Active' and 'Escalated' values to Contract status enum
 *
 * These new statuses enable automatic synchronization between ChatbotDeal
 * status and Contract status:
 * - Active: Deal is in NEGOTIATING state
 * - Escalated: Deal was ESCALATED (can start new negotiation)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // PostgreSQL: Add new values to existing ENUM
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Contracts_status" ADD VALUE IF NOT EXISTS 'Active';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_Contracts_status" ADD VALUE IF NOT EXISTS 'Escalated';
    `);

    console.log('Added Active and Escalated to enum_Contracts_status');
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing ENUM values easily
    // Would need to recreate the enum type which is destructive
    console.log('Cannot remove ENUM values in PostgreSQL - manual intervention required');
    console.log('To revert: recreate enum type without Active/Escalated values');
  }
};
