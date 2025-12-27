import { Model, DataTypes } from "sequelize";

const negotiationRoundModel = (sequelize) => {
    class NegotiationRound extends Model {
        static associate(models) {
            this.belongsTo(models.Negotiation, {
                foreignKey: "negotiationId",
                as: "Negotiation",
            });
        }
    }

    NegotiationRound.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            negotiationId: DataTypes.UUID,
            roundNumber: DataTypes.INTEGER,
            offerDetails: DataTypes.JSONB,
            feedback: DataTypes.JSONB,
        },
        {
            sequelize,
            tableName: "NegotiationRounds",
            timestamps: true,
        }
    );

    return NegotiationRound;
};

export default negotiationRoundModel;
