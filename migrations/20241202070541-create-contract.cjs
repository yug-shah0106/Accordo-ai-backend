"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Contracts", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      companyId: {
        type: Sequelize.INTEGER,
      },
      requisitionId: {
        type: Sequelize.INTEGER,
      },
      vendorId: {
        type: Sequelize.INTEGER,
      },
      benchmarkRating: {
        type: Sequelize.DOUBLE(5, 2),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM(
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
        type: Sequelize.STRING,
      },
      contractDetails: {
        type: Sequelize.STRING,
      },
      openedAt: {
        type: Sequelize.DATE,
      },
      completedAt: {
        type: Sequelize.DATE,
      },
      verifiedAt: {
        type: Sequelize.DATE,
      },
      acceptedAt: {
        type: Sequelize.DATE,
      },
      rejectedAt: {
        type: Sequelize.DATE,
      },
      createdBy: {
        type: Sequelize.INTEGER,
      },
      updatedBy: {
        type: Sequelize.INTEGER,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      quotedAt: {
        type: Sequelize.DATE,
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Contracts");
  },
};
