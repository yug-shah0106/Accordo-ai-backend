'use strict';

import { QueryInterface, DataTypes } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    // Create approval level ENUM type
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_User_approvalLevel" AS ENUM('NONE', 'L1', 'L2', 'L3');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add approvalLevel column to User table
    await queryInterface.addColumn('User', 'approvalLevel', {
      type: DataTypes.ENUM('NONE', 'L1', 'L2', 'L3'),
      allowNull: false,
      defaultValue: 'NONE',
    });

    // Add approvalLimit column (max amount user can approve)
    await queryInterface.addColumn('User', 'approvalLimit', {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: null,
    });

    // Add index on approvalLevel for faster queries
    await queryInterface.addIndex('User', ['approvalLevel'], {
      name: 'idx_user_approval_level',
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeIndex('User', 'idx_user_approval_level');
    await queryInterface.removeColumn('User', 'approvalLimit');
    await queryInterface.removeColumn('User', 'approvalLevel');
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_User_approvalLevel";`);
  },
};
