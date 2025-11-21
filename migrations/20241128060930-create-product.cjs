"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Products", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      productName: {
        type: Sequelize.STRING,
      },
      category: {
        type: Sequelize.STRING,
      },
      brandName: {
        type: Sequelize.STRING,
      },
      gstType: {
        type: Sequelize.ENUM("GST", "Non-GST"),
      },
      tds: {
        type: Sequelize.DOUBLE,
      },
      type: {
        type: Sequelize.ENUM("Goods", "Services"),
        defaultValue: "Goods",
      },
      UOM: {
        type: Sequelize.STRING,
      },
      companyId: {
        type: Sequelize.INTEGER,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Products");
  },
};
