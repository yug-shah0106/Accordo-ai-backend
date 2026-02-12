import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable("Requisitions", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      projectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Projects",
          key: "id",
        },
      },
      rfqId: {
        type: DataTypes.STRING,
      },
      subject: {
        type: DataTypes.STRING,
      },
      category: {
        type: DataTypes.STRING,
      },
      deliveryDate: {
        type: DataTypes.DATE,
      },
      negotiationClosureDate: {
        type: DataTypes.DATE,
      },
      typeOfCurrency: {
        type: DataTypes.ENUM("USD", "INR", "EUR"),
      },
      targetPrice: {
        type: DataTypes.DOUBLE,
      },
      totalPrice: {
        type: DataTypes.DOUBLE,
      },
      status: {
        type: DataTypes.ENUM("Created", "Fulfilled", "Benchmarked", "InitialQuotation", "Closed", "Awarded", "Cancelled", "Expired"),
      },
      savingsInPrice: {
        type: DataTypes.DOUBLE,
      },
      createdBy: {
        type: DataTypes.INTEGER,
      },
      fulfilledAt: {
        type: DataTypes.DATE,
      },
      fulfilledBy: {
        type: DataTypes.INTEGER,
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE,
      },
      benchmarkedAt: {
        type: DataTypes.DATE,
      },
      benchmarkedBy: {
        type: DataTypes.INTEGER,
      },
      benchmarkResponse: {
        type: DataTypes.TEXT,
      }
    });
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable("Requisitions");
  },
};
