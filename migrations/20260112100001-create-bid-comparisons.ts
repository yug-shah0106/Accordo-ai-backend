import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('bid_comparisons', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      requisition_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Requisitions',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      triggered_by: {
        type: DataTypes.ENUM('ALL_COMPLETED', 'DEADLINE_REACHED', 'MANUAL'),
        allowNull: false,
        comment: 'What triggered this comparison generation',
      },
      total_vendors: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total number of vendors attached to requisition',
      },
      completed_vendors: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of vendors who completed negotiations',
      },
      excluded_vendors: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of vendors excluded (walked away without resolution)',
      },
      top_bids_json: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Array of top bids with vendor details and pricing',
      },
      pdf_url: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Path or URL to the generated PDF report',
      },
      sent_to_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'User',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Procurement owner who receives the comparison',
      },
      sent_to_email: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Email address comparison was sent to',
      },
      email_status: {
        type: DataTypes.ENUM('PENDING', 'SENT', 'FAILED'),
        allowNull: false,
        defaultValue: 'PENDING',
        comment: 'Status of the email notification',
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
      generated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the comparison report was generated',
      },
      sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the email was sent',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes
    await queryInterface.addIndex('bid_comparisons', ['requisition_id']);
    await queryInterface.addIndex('bid_comparisons', ['triggered_by']);
    await queryInterface.addIndex('bid_comparisons', ['generated_at']);
    await queryInterface.addIndex('bid_comparisons', ['email_status']);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('bid_comparisons');
  },
};
