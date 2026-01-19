import { QueryInterface, DataTypes } from 'sequelize';


export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('chatbot_template_parameters', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      template_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'chatbot_templates',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      parameter_key: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Parameter name (e.g., "price", "delivery_time", "payment_terms")',
      },
      parameter_type: {
        type: DataTypes.ENUM('number', 'string', 'boolean', 'date'),
        allowNull: false,
        defaultValue: 'number',
      },
      weight: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Importance weight for utility calculation (0-100)',
      },
      min_value: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      max_value: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      default_value: {
        type: DataTypes.TEXT,
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

    // Add indexes
    await queryInterface.addIndex('chatbot_template_parameters', ['template_id']);
    await queryInterface.addIndex('chatbot_template_parameters', ['parameter_key']);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('chatbot_template_parameters');
  },
};
