import { QueryInterface, DataTypes } from 'sequelize';


export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn("Contracts", "finalRating", {
      type: DataTypes.DOUBLE(5, 2),
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn("Contracts", "finalRating");
  },
};
