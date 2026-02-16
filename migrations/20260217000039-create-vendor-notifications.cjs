'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vendor_notifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      selection_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'vendor_selections',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      vendor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'User',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      bid_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'vendor_bids',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      notification_type: {
        type: Sequelize.ENUM('SELECTION_WON', 'SELECTION_LOST'),
        allowNull: false,
      },
      email_log_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'EmailLogs',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      email_status: {
        type: Sequelize.ENUM('PENDING', 'SENT', 'FAILED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('vendor_notifications', ['selection_id']);
    await queryInterface.addIndex('vendor_notifications', ['vendor_id']);
    await queryInterface.addIndex('vendor_notifications', ['notification_type']);
    await queryInterface.addIndex('vendor_notifications', ['email_status']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('vendor_notifications');
  },
};
