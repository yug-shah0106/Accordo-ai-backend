'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Negotiations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      rfqId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Requisitions',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      vendorId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'User',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      status: {
        type: Sequelize.ENUM('active', 'completed', 'failed'),
        allowNull: true,
        defaultValue: 'active',
      },
      round: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      score: {
        type: Sequelize.FLOAT,
        allowNull: true,
        defaultValue: 0.0,
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
    await queryInterface.dropTable('Negotiations');
  },
};
