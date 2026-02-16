'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('negotiation_patterns', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      embedding: {
        type: Sequelize.ARRAY(Sequelize.FLOAT),
        allowNull: false,
      },
      content_text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      pattern_type: {
        type: Sequelize.ENUM('successful_negotiation', 'failed_negotiation', 'escalation', 'walkaway', 'quick_acceptance'),
        allowNull: false,
      },
      pattern_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      scenario: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      avg_utility: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: true,
      },
      avg_rounds: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      avg_price_reduction: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: true,
      },
      success_rate: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: true,
      },
      sample_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      product_categories: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
      },
      price_ranges: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
      },
      vendor_types: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
      },
      key_factors: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      example_deal_ids: {
        type: Sequelize.ARRAY(Sequelize.UUID),
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.addIndex('negotiation_patterns', ['pattern_type'], { name: 'idx_negotiation_patterns_type' });
    await queryInterface.addIndex('negotiation_patterns', ['scenario'], { name: 'idx_negotiation_patterns_scenario' });
    await queryInterface.addIndex('negotiation_patterns', ['success_rate'], { name: 'idx_negotiation_patterns_success_rate' });
    await queryInterface.addIndex('negotiation_patterns', ['is_active'], { name: 'idx_negotiation_patterns_active' });
    await queryInterface.addIndex('negotiation_patterns', ['created_at'], { name: 'idx_negotiation_patterns_created_at' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('negotiation_patterns');
  },
};
