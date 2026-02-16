'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Products', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      productName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      category: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      brandName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      gstType: {
        type: Sequelize.ENUM('GST', 'Non-GST'),
        allowNull: true,
      },
      gstPercentage: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      tds: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      type: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      UOM: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      companyId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Companies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Products');
  },
};
