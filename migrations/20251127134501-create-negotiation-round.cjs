import { QueryInterface, DataTypes } from 'sequelize';

export default {
    async up(queryInterface: QueryInterface): Promise<void> {
        await queryInterface.createTable('NegotiationRounds', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4
            },
            negotiationId: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'Negotiations',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            roundNumber: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            offerDetails: {
                type: DataTypes.JSONB,
                allowNull: false
            },
            feedback: {
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
        await queryInterface.dropTable('NegotiationRounds');
    }
};
