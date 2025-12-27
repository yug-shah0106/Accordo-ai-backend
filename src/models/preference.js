import { Model, DataTypes } from "sequelize";

const preferenceModel = (sequelize) => {
    class Preference extends Model {
        static associate(models) {
            // Polymorphic association could be complex, so we'll keep it simple for now
            // or add specific methods if needed.
        }
    }

    Preference.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            entityId: DataTypes.INTEGER,
            entityType: DataTypes.STRING, // 'User' or 'Company'
            context: {
                type: DataTypes.STRING,
                defaultValue: "global",
            },
            weights: DataTypes.JSONB,
            constraints: DataTypes.JSONB,
        },
        {
            sequelize,
            tableName: "Preferences",
            timestamps: true,
        }
    );

    return Preference;
};

export default preferenceModel;
