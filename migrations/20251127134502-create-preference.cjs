import { QueryInterface, DataTypes } from 'sequelize';

export default {
    async up(queryInterface: QueryInterface): Promise<void> {
        await queryInterface.createTable('Preferences', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4
            },
            entityId: {
                type: DataTypes.INTEGER,
                allowNull: false
                // Can reference User (Vendor) or Company (Buyer) - polymorphic or just ID
            },
            entityType: {
                type: DataTypes.STRING, // 'User' or 'Company'
                allowNull: false
            },
            context: {
                type: DataTypes.STRING, // 'global' or 'rfq_specific'
                defaultValue: 'global'
            },
            weights: {
                type: DataTypes.JSONB,
                allowNull: false
            },
            constraints: {
                type: DataTypes.JSONB,
                allowNull: true
            },
            createdAt: {
                allowNull: false,
                type: DataTypes.DATE
            },
            updatedAt: {
                allowNull: false,
                type: DataTypes.DATE
            }
        });
    },

    async down(queryInterface: QueryInterface): Promise<void> {
        await queryInterface.dropTable('Preferences');
    }
};
