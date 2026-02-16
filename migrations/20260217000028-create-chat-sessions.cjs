'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ChatSessions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      negotiationId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Negotiations',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'User',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      history: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      context: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
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
    await queryInterface.dropTable('ChatSessions');
  },
};
