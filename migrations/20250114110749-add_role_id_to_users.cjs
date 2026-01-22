import { QueryInterface, DataTypes } from 'sequelize';


export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn("User", "roleId", {
      type: DataTypes.INTEGER,
      after: "companyId",
      references: {
        model: "Roles",
        key: "id",
      },
    });
    await queryInterface.addColumn("User", "status", {
      type: DataTypes.STRING,
      after: "roleId",
      defaultValue: "active",
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn("User", "status");
    await queryInterface.removeColumn("User", "roleId");
  },
};
