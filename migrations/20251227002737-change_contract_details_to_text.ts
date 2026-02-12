import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.changeColumn("Contracts", "contractDetails", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.changeColumn("Contracts", "contractDetails", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  },
};
