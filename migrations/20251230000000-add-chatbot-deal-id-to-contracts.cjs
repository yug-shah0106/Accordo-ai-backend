import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn("Contracts", "chatbotDealId", {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "Reference to the deal ID in the chatbot system",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Contracts", "chatbotDealId");
  },
};
