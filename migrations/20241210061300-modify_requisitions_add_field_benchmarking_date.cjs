import { QueryInterface, DataTypes } from 'sequelize';


export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const table = await queryInterface.describeTable("Requisitions");
    if (!table.benchmarkingDate) {
      await queryInterface.addColumn("Requisitions", "benchmarkingDate", {
        type: DataTypes.DATE,
        after: "benchmarkedAt",
      });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const table = await queryInterface.describeTable("Requisitions");
    if (table.benchmarkingDate) {
      await queryInterface.removeColumn("Requisitions", "benchmarkingDate");
    }
  },
};
