'use strict';

import { QueryInterface, DataTypes } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    // Create approval status ENUM for requisitions
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_Requisitions_approvalStatus" AS ENUM(
          'NOT_SUBMITTED',
          'PENDING_L1',
          'APPROVED_L1',
          'PENDING_L2',
          'APPROVED_L2',
          'PENDING_L3',
          'APPROVED_L3',
          'FULLY_APPROVED',
          'REJECTED'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add approvalStatus column to Requisitions table
    await queryInterface.addColumn('Requisitions', 'approvalStatus', {
      type: DataTypes.ENUM(
        'NOT_SUBMITTED',
        'PENDING_L1',
        'APPROVED_L1',
        'PENDING_L2',
        'APPROVED_L2',
        'PENDING_L3',
        'APPROVED_L3',
        'FULLY_APPROVED',
        'REJECTED'
      ),
      allowNull: false,
      defaultValue: 'NOT_SUBMITTED',
    });

    // Add currentApprovalLevel (L1, L2, L3, or null if fully approved)
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_Requisitions_currentApprovalLevel" AS ENUM('L1', 'L2', 'L3');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.addColumn('Requisitions', 'currentApprovalLevel', {
      type: DataTypes.ENUM('L1', 'L2', 'L3'),
      allowNull: true,
      defaultValue: null,
    });

    // Add total estimated amount for approval threshold calculations
    await queryInterface.addColumn('Requisitions', 'totalEstimatedAmount', {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: null,
    });

    // Add required approval level based on amount
    await queryInterface.addColumn('Requisitions', 'requiredApprovalLevel', {
      type: DataTypes.ENUM('L1', 'L2', 'L3'),
      allowNull: true,
      defaultValue: null,
    });

    // Add submittedForApprovalAt timestamp
    await queryInterface.addColumn('Requisitions', 'submittedForApprovalAt', {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    });

    // Add submittedByUserId
    await queryInterface.addColumn('Requisitions', 'submittedByUserId', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'User',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Add index on approvalStatus
    await queryInterface.addIndex('Requisitions', ['approvalStatus'], {
      name: 'idx_requisitions_approval_status',
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeIndex('Requisitions', 'idx_requisitions_approval_status');
    await queryInterface.removeColumn('Requisitions', 'submittedByUserId');
    await queryInterface.removeColumn('Requisitions', 'submittedForApprovalAt');
    await queryInterface.removeColumn('Requisitions', 'requiredApprovalLevel');
    await queryInterface.removeColumn('Requisitions', 'totalEstimatedAmount');
    await queryInterface.removeColumn('Requisitions', 'currentApprovalLevel');
    await queryInterface.removeColumn('Requisitions', 'approvalStatus');
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_Requisitions_approvalStatus";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_Requisitions_currentApprovalLevel";`);
  },
};
