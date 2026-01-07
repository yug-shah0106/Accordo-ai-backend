import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('negotiation_training_data', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
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
        comment: 'Foreign key to chatbot_deals table',
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'User who requested the suggestions',
      },
      round: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Negotiation round when suggestions were generated',
      },
      suggestions_json: {
        type: DataTypes.JSONB,
        allowNull: false,
        comment: 'Generated suggestions for all scenarios (HARD, MEDIUM, SOFT, WALK_AWAY)',
      },
      conversation_context: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Conversation history at time of generation',
      },
      config_snapshot: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Negotiation config at time of generation',
      },
      llm_model: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'LLM model used for generation (e.g., llama3.2)',
      },
      generation_source: {
        type: DataTypes.ENUM('llm', 'fallback'),
        allowNull: false,
        defaultValue: 'llm',
        comment: 'Whether suggestions came from LLM or fallback logic',
      },
      selected_scenario: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Scenario selected by user (HARD, MEDIUM, SOFT, WALK_AWAY)',
      },
      selected_suggestion: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Specific suggestion text selected by user',
      },
      deal_outcome: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Final deal outcome (ACCEPTED, REJECTED, ESCALATED, etc.)',
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
    await queryInterface.addIndex('negotiation_training_data', ['deal_id'], {
      name: 'idx_training_data_deal_id',
    });

    await queryInterface.addIndex('negotiation_training_data', ['user_id'], {
      name: 'idx_training_data_user_id',
    });

    await queryInterface.addIndex('negotiation_training_data', ['created_at'], {
      name: 'idx_training_data_created_at',
    });

    await queryInterface.addIndex('negotiation_training_data', ['generation_source'], {
      name: 'idx_training_data_generation_source',
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('negotiation_training_data');
  },
};
