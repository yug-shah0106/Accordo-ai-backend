'use strict';

/**
 * Migration: Fix Product gstType casing and set default type
 *
 * This migration:
 * 1. Fixes any "Non-Gst" values to "Non-GST" in the Products table
 * 2. Sets default "type" value to "Goods" for products without a type
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Fix any "Non-Gst" to "Non-GST" (case mismatch)
    await queryInterface.sequelize.query(`
      UPDATE "Products"
      SET "gstType" = 'Non-GST'
      WHERE "gstType" = 'Non-Gst';
    `);

    // Also fix any other case variations just to be safe
    await queryInterface.sequelize.query(`
      UPDATE "Products"
      SET "gstType" = 'Non-GST'
      WHERE LOWER("gstType") = 'non-gst' AND "gstType" != 'Non-GST';
    `);

    // Set default type to "Goods" for products without a type
    await queryInterface.sequelize.query(`
      UPDATE "Products"
      SET "type" = 'Goods'
      WHERE "type" IS NULL;
    `);

    // Set type to "Services" for software-related products (by category)
    await queryInterface.sequelize.query(`
      UPDATE "Products"
      SET "type" = 'Services'
      WHERE LOWER("category") = 'software' AND "type" = 'Goods';
    `);

    console.log('Fixed gstType casing and set default type in Products table');
  },

  async down(queryInterface, Sequelize) {
    // This migration is not reversible in a meaningful way
    // The data was already inconsistent before the migration
    console.log('Rollback: No action taken - values remain as is');
  }
};
