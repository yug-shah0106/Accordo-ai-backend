'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add customIndustryType column
    await queryInterface.addColumn('Companies', 'customIndustryType', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    // For PostgreSQL, we need to alter the ENUM type to add new values
    // First, get the current enum type name
    const enumTypeName = 'enum_Companies_industryType';

    // Add new enum values (PostgreSQL specific)
    const newValues = [
      'Construction',
      'Healthcare',
      'Transportation',
      'Information Technology',
      'Oil and Gas',
      'Defence',
      'Renewable Energy',
      'Telecommunication',
      'Agriculture',
      'Other',
    ];

    // Add each new value to the enum if it doesn't exist
    for (const value of newValues) {
      try {
        await queryInterface.sequelize.query(
          `ALTER TYPE "${enumTypeName}" ADD VALUE IF NOT EXISTS '${value}'`
        );
      } catch (error) {
        // Value might already exist, continue
        console.log(`Note: ${value} may already exist in enum`);
      }
    }

    console.log('Migration complete: Industry type enum updated and customIndustryType column added');
  },

  async down(queryInterface, Sequelize) {
    // Remove customIndustryType column
    await queryInterface.removeColumn('Companies', 'customIndustryType');

    // Note: Removing enum values in PostgreSQL is complex and typically not done
    // The old values (Industry1, Industry2) will remain but be unused
    console.log('Migration reverted: customIndustryType column removed');
  },
};
