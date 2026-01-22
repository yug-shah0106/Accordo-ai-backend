'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ENUM type for action
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_bid_action_histories_action" AS ENUM (
          'SELECTED', 'REJECTED', 'RESTORED', 'VIEWED', 'EXPORTED', 'COMPARISON_GENERATED'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.createTable('bid_action_histories', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      requisition_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Requisitions',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      bid_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'vendor_bids',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'User',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      action: {
        type: Sequelize.ENUM('SELECTED', 'REJECTED', 'RESTORED', 'VIEWED', 'EXPORTED', 'COMPARISON_GENERATED'),
        allowNull: false,
      },
      action_details: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Additional details about the action (vendor name, prices, etc.)',
      },
      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'User-provided remarks for the action',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes for performance
    await queryInterface.addIndex('bid_action_histories', ['requisition_id']);
    await queryInterface.addIndex('bid_action_histories', ['bid_id']);
    await queryInterface.addIndex('bid_action_histories', ['user_id']);
    await queryInterface.addIndex('bid_action_histories', ['action']);
    await queryInterface.addIndex('bid_action_histories', ['created_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('bid_action_histories');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_bid_action_histories_action";');
  },
};
