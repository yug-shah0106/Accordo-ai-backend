import { QueryInterface, DataTypes } from 'sequelize';


export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn('chatbot_deals', 'last_accessed', {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.literal('CURRENT_TIMESTAMP'),
      comment: 'Timestamp when deal was last viewed/accessed',
    });

    await queryInterface.addColumn('chatbot_deals', 'last_message_at', {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp of last message in the deal',
    });

    await queryInterface.addColumn('chatbot_deals', 'view_count', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of times the deal has been accessed',
    });

    // Add index for last_accessed to optimize history queries
    await queryInterface.addIndex('chatbot_deals', ['last_accessed'], {
      name: 'idx_chatbot_deals_last_accessed',
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeIndex('chatbot_deals', 'idx_chatbot_deals_last_accessed');
    await queryInterface.removeColumn('chatbot_deals', 'view_count');
    await queryInterface.removeColumn('chatbot_deals', 'last_message_at');
    await queryInterface.removeColumn('chatbot_deals', 'last_accessed');
  },
};
