"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Pos", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      contractId: {
        type: Sequelize.INTEGER,
      },
      requisitionId: {
        type: Sequelize.INTEGER,
      },
      companyId: {
        type: Sequelize.INTEGER,
      },
      vendorId: {
        type: Sequelize.INTEGER,
      },
      lineItems: {
        type: Sequelize.STRING,
      },
      subTotal: {
        type: Sequelize.DOUBLE,
      },
      taxTotal: {
        type: Sequelize.DOUBLE,
      },
      total: {
        type: Sequelize.DOUBLE,
      },
      status: {
        type: Sequelize.ENUM("Created", "Cancelled"),
      },
      poNumber: {
        type: Sequelize.STRING,
      },
      poUrl: {
        type: Sequelize.STRING,
      },
      deliveryDate: {
        type: Sequelize.DATE,
      },
      paymentTerms: {
        type: Sequelize.STRING,
      },
      addedBy: {
        type: Sequelize.INTEGER,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Pos");
  },
};
