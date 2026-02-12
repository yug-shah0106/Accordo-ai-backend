import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('vendor_bids', {
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
      contract_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Contracts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      deal_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'chatbot_deals',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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
      },
      final_price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Final negotiated total price',
      },
      unit_price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Final negotiated unit price',
      },
      payment_terms: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Final payment terms (e.g., Net 30, Net 60)',
      },
      delivery_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Promised delivery date',
      },
      utility_score: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: true,
        comment: 'Final utility score (0-1)',
      },
      bid_status: {
        type: DataTypes.ENUM('PENDING', 'COMPLETED', 'EXCLUDED', 'SELECTED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'PENDING',
        comment: 'Status of the bid in the comparison process',
      },
      deal_status: {
        type: DataTypes.ENUM('NEGOTIATING', 'ACCEPTED', 'WALKED_AWAY', 'ESCALATED'),
        allowNull: false,
        defaultValue: 'NEGOTIATING',
        comment: 'Status of the underlying chatbot deal',
      },
      chat_summary_metrics: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Structured metrics from negotiation (rounds, price changes, etc.)',
      },
      chat_summary_narrative: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'LLM-generated narrative summary of negotiation',
      },
      chat_link: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'URL to view full chat history',
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the negotiation completed',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes
    await queryInterface.addIndex('vendor_bids', ['requisition_id']);
    await queryInterface.addIndex('vendor_bids', ['vendor_id']);
    await queryInterface.addIndex('vendor_bids', ['bid_status']);
    await queryInterface.addIndex('vendor_bids', ['final_price']);
    await queryInterface.addIndex('vendor_bids', ['deal_id']);
    await queryInterface.addIndex('vendor_bids', ['contract_id']);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('vendor_bids');
  },
};
