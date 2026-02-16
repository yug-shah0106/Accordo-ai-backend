'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Preferences', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      entityId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      entityType: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      context: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'global',
      },
      weights: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      constraints: {
        type: Sequelize.JSONB,
        allowNull: true,
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
    await queryInterface.dropTable('Preferences');
  },
};
