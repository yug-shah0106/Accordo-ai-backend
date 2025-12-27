'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('NegotiationRounds', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4
            },
            negotiationId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'Negotiations',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            roundNumber: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            offerDetails: {
                type: Sequelize.JSONB,
                allowNull: false
            },
            feedback: {
                type: Sequelize.JSONB,
                allowNull: true
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('NegotiationRounds');
    }
};
