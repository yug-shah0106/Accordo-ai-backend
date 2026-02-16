'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('NegotiationRounds', {
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
      roundNumber: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      offerDetails: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      feedback: {
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
    await queryInterface.dropTable('NegotiationRounds');
  },
};
