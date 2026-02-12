import { QueryInterface, DataTypes } from 'sequelize';


export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn("User", "profilePic", {
      type: DataTypes.STRING,
      after: "name",
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn("User", "profilePic");
  },
};
