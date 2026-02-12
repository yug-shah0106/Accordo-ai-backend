import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('vendor_notifications', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      selection_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'vendor_selections',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Reference to the selection decision',
      },
      vendor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'User',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Vendor receiving this notification',
      },
      bid_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'vendor_bids',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'The bid this notification relates to',
      },
      notification_type: {
        type: DataTypes.ENUM('SELECTION_WON', 'SELECTION_LOST'),
        allowNull: false,
        comment: 'Whether vendor won or lost the selection',
      },
      email_log_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'EmailLogs',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Reference to email log for audit',
      },
      email_status: {
        type: DataTypes.ENUM('PENDING', 'SENT', 'FAILED'),
        allowNull: false,
        defaultValue: 'PENDING',
        comment: 'Status of the notification email',
      },
      sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the notification email was sent',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes
    await queryInterface.addIndex('vendor_notifications', ['selection_id']);
    await queryInterface.addIndex('vendor_notifications', ['vendor_id']);
    await queryInterface.addIndex('vendor_notifications', ['notification_type']);
    await queryInterface.addIndex('vendor_notifications', ['email_status']);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('vendor_notifications');
  },
};
