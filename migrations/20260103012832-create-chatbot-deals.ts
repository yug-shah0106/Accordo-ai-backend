import { QueryInterface, DataTypes } from 'sequelize';


export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('chatbot_deals', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      counterparty: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Vendor company name',
      },
      status: {
        type: DataTypes.ENUM('NEGOTIATING', 'ACCEPTED', 'WALKED_AWAY', 'ESCALATED'),
        allowNull: false,
        defaultValue: 'NEGOTIATING',
      },
      round: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Current negotiation round number',
      },
      mode: {
        type: DataTypes.ENUM('INSIGHTS', 'CONVERSATION'),
        allowNull: false,
        defaultValue: 'CONVERSATION',
        comment: 'INSIGHTS = demo mode with automatic vendor, CONVERSATION = chat mode',
      },
      latest_offer_json: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Last offer from Accordo to vendor',
      },
      latest_vendor_offer: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Last offer from vendor',
      },
      latest_decision_action: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Last decision action: accept, counter, reject, escalate',
      },
      latest_utility: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Utility score of latest offer (0-100)',
      },
      convo_state_json: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Conversation state for conversation mode',
      },
      template_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'chatbot_templates',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      requisition_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'Requisitions',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      contract_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'Contracts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Internal user managing the deal',
      },
      vendor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Vendor user in conversation mode',
      },
      archived_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
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

    // Add indexes for common queries
    await queryInterface.addIndex('chatbot_deals', ['status']);
    await queryInterface.addIndex('chatbot_deals', ['mode']);
    await queryInterface.addIndex('chatbot_deals', ['requisition_id']);
    await queryInterface.addIndex('chatbot_deals', ['contract_id']);
    await queryInterface.addIndex('chatbot_deals', ['user_id']);
    await queryInterface.addIndex('chatbot_deals', ['vendor_id']);
    await queryInterface.addIndex('chatbot_deals', ['archived_at']);
    await queryInterface.addIndex('chatbot_deals', ['deleted_at']);
    await queryInterface.addIndex('chatbot_deals', ['created_at']);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('chatbot_deals');
  },
};
