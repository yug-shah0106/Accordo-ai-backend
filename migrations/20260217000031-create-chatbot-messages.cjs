'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('chatbot_messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
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
      role: {
        type: Sequelize.ENUM('VENDOR', 'ACCORDO', 'SYSTEM'),
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      extracted_offer: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      engine_decision: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      decision_action: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      utility_score: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      counter_offer: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      explainability_json: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      round: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('chatbot_messages');
  },
};
