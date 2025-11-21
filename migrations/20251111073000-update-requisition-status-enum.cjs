"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const addValue = async (value) => {
      await queryInterface.sequelize.query(`DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = '${value}'
          AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'enum_Requisitions_status'
          )
        ) THEN
          ALTER TYPE "enum_Requisitions_status" ADD VALUE '${value}';
        END IF;
      END
      $$;`);
    };

    await addValue("Draft");
    await addValue("NegotiationStarted");
  },

  async down(queryInterface, Sequelize) {
    // Postgres does not support removing enum values easily; no-op on downgrade.
  },
};
