import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn('chatbot_deals', 'negotiation_config_json', {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Negotiation configuration for this deal (copied from template or custom)',
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn('chatbot_deals', 'negotiation_config_json');
  },
};
