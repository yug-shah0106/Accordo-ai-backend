'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('negotiation_training_data', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      deal_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'chatbot_deals',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      round: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      suggestions_json: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      conversation_context: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      config_snapshot: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      llm_model: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      generation_source: {
        type: Sequelize.ENUM('llm', 'fallback'),
        allowNull: false,
        defaultValue: 'llm',
      },
      selected_scenario: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      selected_suggestion: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      deal_outcome: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('negotiation_training_data');
  },
};
