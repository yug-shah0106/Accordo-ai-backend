import { QueryInterface, DataTypes } from 'sequelize';


export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn("Products", "gstPercentage", {
      type: DataTypes.INTEGER,
      allowNull: true,
      after: "gstType",
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn("Products", "gstPercentage");
  },
};
