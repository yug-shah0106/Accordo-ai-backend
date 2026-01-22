'use strict';

import { QueryInterface, DataTypes } from 'sequelize';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    // Create approval status ENUM
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_Approvals_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'CANCELLED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create approval level ENUM for this table
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_Approvals_approvalLevel" AS ENUM('L1', 'L2', 'L3');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create priority ENUM
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_Approvals_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.createTable('Approvals', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      requisitionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Requisitions',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      approvalLevel: {
        type: DataTypes.ENUM('L1', 'L2', 'L3'),
        allowNull: false,
      },
      assignedToUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'User',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      approvedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'User',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      rejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      comments: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      dueDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      priority: {
        type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT'),
        allowNull: false,
        defaultValue: 'MEDIUM',
      },
      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      escalatedFromId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Approvals',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      emailLogId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'EmailLogs',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    // Add indexes
    await queryInterface.addIndex('Approvals', ['requisitionId'], {
      name: 'idx_approvals_requisition_id',
    });
    await queryInterface.addIndex('Approvals', ['assignedToUserId'], {
      name: 'idx_approvals_assigned_to_user_id',
    });
    await queryInterface.addIndex('Approvals', ['status'], {
      name: 'idx_approvals_status',
    });
    await queryInterface.addIndex('Approvals', ['approvalLevel'], {
      name: 'idx_approvals_approval_level',
    });
    await queryInterface.addIndex('Approvals', ['dueDate'], {
      name: 'idx_approvals_due_date',
    });
    await queryInterface.addIndex('Approvals', ['requisitionId', 'approvalLevel'], {
      name: 'idx_approvals_requisition_level',
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('Approvals');
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_Approvals_status";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_Approvals_approvalLevel";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_Approvals_priority";`);
  },
};
