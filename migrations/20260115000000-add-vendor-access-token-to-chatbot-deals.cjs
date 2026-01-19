import { QueryInterface, DataTypes, Sequelize } from 'sequelize';
import { Op } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn('chatbot_deals', 'vendor_access_token', {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Magic link token for vendor access - valid until deal closes',
    });

    // Add partial unique index for non-null tokens (allows multiple NULL values)
    await queryInterface.addIndex('chatbot_deals', ['vendor_access_token'], {
      name: 'idx_chatbot_deals_vendor_access_token',
      unique: true,
      where: {
        vendor_access_token: { [Op.ne]: null },
      },
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeIndex('chatbot_deals', 'idx_chatbot_deals_vendor_access_token');
    await queryInterface.removeColumn('chatbot_deals', 'vendor_access_token');
  },
};
