import { QueryInterface, DataTypes } from 'sequelize';


export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn("Contracts", "finalContractDetails", {
      type: DataTypes.TEXT,
      after: "contractDetails",
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn("Contracts", "finalContractDetails");
  },
};
