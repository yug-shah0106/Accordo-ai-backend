"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Requisitions", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      projectId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Projects",
          key: "id",
        },
      },
      rfqId: {
        type: Sequelize.STRING,
      },
      subject: {
        type: Sequelize.STRING,
      },
      category: {
        type: Sequelize.STRING,
      },
      deliveryDate: {
        type: Sequelize.DATE,
      },
      negotiationClosureDate: {
        type: Sequelize.DATE,
      },
      typeOfCurrency: {
        type: Sequelize.ENUM("USD", "INR", "EUR"),
      },
      targetPrice: {
        type: Sequelize.DOUBLE,
      },
      totalPrice: {
        type: Sequelize.DOUBLE,
      },
      status: {
        type: Sequelize.ENUM("Created", "Fulfilled", "Benchmarked", "InitialQuotation", "Closed", "Awarded", "Cancelled", "Expired"),
      },
      savingsInPrice: {
        type: Sequelize.DOUBLE,
      },
      createdBy: {
        type: Sequelize.INTEGER,
      },
      fulfilledAt: {
        type: Sequelize.DATE,
      },
      fulfilledBy: {
        type: Sequelize.INTEGER,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      benchmarkedAt: {
        type: Sequelize.DATE,
      },
      benchmarkedBy: {
        type: Sequelize.INTEGER,
      },
      benchmarkResponse: {
        type: Sequelize.TEXT,
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Requisitions");
  },
};
