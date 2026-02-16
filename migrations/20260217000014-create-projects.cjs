'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Projects', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      projectName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      projectId: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      },
      projectAddress: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      typeOfProject: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      tenureInDays: {
        type: Sequelize.INTEGER,
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
    await queryInterface.dropTable('Projects');
  },
};
