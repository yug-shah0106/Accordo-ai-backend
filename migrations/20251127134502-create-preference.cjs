'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('Preferences', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4
            },
            entityId: {
                type: Sequelize.INTEGER,
                allowNull: false
                // Can reference User (Vendor) or Company (Buyer) - polymorphic or just ID
            },
            entityType: {
                type: Sequelize.STRING, // 'User' or 'Company'
                allowNull: false
            },
            context: {
                type: Sequelize.STRING, // 'global' or 'rfq_specific'
                defaultValue: 'global'
            },
            weights: {
                type: Sequelize.JSONB,
                allowNull: false
            },
            constraints: {
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
        await queryInterface.dropTable('Preferences');
    }
};
