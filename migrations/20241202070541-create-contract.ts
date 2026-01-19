import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable("Contracts", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      companyId: {
        type: DataTypes.INTEGER,
      },
      requisitionId: {
        type: DataTypes.INTEGER,
      },
      vendorId: {
        type: DataTypes.INTEGER,
      },
      benchmarkRating: {
        type: DataTypes.DOUBLE(5, 2),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM(
          "Created",
          "Opened",
          "Completed",
          "Verified",
          "Accepted",
          "Rejected",
          "Expired",
          "InitialQuotation"
        ),
        defaultValue: "Created",
      },
      uniqueToken: {
        type: DataTypes.STRING,
      },
      contractDetails: {
        type: DataTypes.STRING,
      },
      openedAt: {
        type: DataTypes.DATE,
      },
      completedAt: {
        type: DataTypes.DATE,
      },
      verifiedAt: {
        type: DataTypes.DATE,
      },
      acceptedAt: {
        type: DataTypes.DATE,
      },
      rejectedAt: {
        type: DataTypes.DATE,
      },
      createdBy: {
        type: DataTypes.INTEGER,
      },
      updatedBy: {
        type: DataTypes.INTEGER,
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE,
      },
      quotedAt: {
        type: DataTypes.DATE,
      },
    });
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable("Contracts");
  },
};
