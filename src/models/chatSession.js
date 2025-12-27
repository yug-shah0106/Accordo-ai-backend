import { Model, DataTypes } from "sequelize";

const chatSessionModel = (sequelize) => {
    class ChatSession extends Model {
        static associate(models) {
            this.belongsTo(models.Negotiation, {
                foreignKey: "negotiationId",
                as: "Negotiation",
            });
            this.belongsTo(models.User, {
                foreignKey: "userId",
                as: "User",
            });
        }
    }

    ChatSession.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            negotiationId: DataTypes.UUID,
            userId: DataTypes.INTEGER,
            history: {
                type: DataTypes.JSONB,
                defaultValue: [],
            },
            context: {
                type: DataTypes.JSONB,
                defaultValue: {},
            },
        },
        {
            sequelize,
            tableName: "ChatSessions",
            timestamps: true,
        }
    );

    return ChatSession;
};

export default chatSessionModel;
