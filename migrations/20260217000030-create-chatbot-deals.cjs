'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('chatbot_deals', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      counterparty: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('NEGOTIATING', 'ACCEPTED', 'WALKED_AWAY', 'ESCALATED'),
        allowNull: false,
        defaultValue: 'NEGOTIATING',
      },
      round: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      mode: {
        type: Sequelize.ENUM('INSIGHTS', 'CONVERSATION'),
        allowNull: false,
        defaultValue: 'CONVERSATION',
      },
      latest_offer_json: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      latest_vendor_offer: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      latest_decision_action: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      latest_utility: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      convo_state_json: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      negotiation_config_json: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      template_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'chatbot_templates',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      requisition_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Requisitions',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      contract_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Contracts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'User',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      vendor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'User',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      archived_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_accessed: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.NOW,
      },
      last_message_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      view_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('chatbot_deals');
  },
};
