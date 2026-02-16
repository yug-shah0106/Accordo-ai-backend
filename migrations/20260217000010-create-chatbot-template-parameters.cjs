'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('chatbot_template_parameters', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      template_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'chatbot_templates',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      parameter_key: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      parameter_type: {
        type: Sequelize.ENUM('number', 'string', 'boolean', 'date'),
        allowNull: false,
        defaultValue: 'number',
      },
      weight: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      min_value: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      max_value: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      default_value: {
        type: Sequelize.TEXT,
        allowNull: true,
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
    await queryInterface.dropTable('chatbot_template_parameters');
  },
};
