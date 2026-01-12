import { QueryInterface, DataTypes } from 'sequelize';

export default {
    async up(queryInterface: QueryInterface): Promise<void> {
        await queryInterface.createTable('Negotiations', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4
            },
            rfqId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'Requisitions',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            vendorId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'User',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            status: {
                type: DataTypes.ENUM('active', 'completed', 'failed'),
                defaultValue: 'active'
            },
            round: {
                type: DataTypes.INTEGER,
                defaultValue: 1
            },
            score: {
                type: DataTypes.FLOAT,
                defaultValue: 0.0
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
        await queryInterface.dropTable('Negotiations');
    }
};
