'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add deal_id column to track ChatbotDeal ID separately from bid_id (VendorBid ID)
    await queryInterface.addColumn('bid_action_histories', 'deal_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'chatbot_deals',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Add index for deal_id
    await queryInterface.addIndex('bid_action_histories', ['deal_id'], {
      name: 'bid_action_histories_deal_id_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('bid_action_histories', 'bid_action_histories_deal_id_idx');
    await queryInterface.removeColumn('bid_action_histories', 'deal_id');
  },
};
