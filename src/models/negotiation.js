import { Model, DataTypes } from "sequelize";

const negotiationModel = (sequelize) => {
    class Negotiation extends Model {
        static associate(models) {
            this.belongsTo(models.Requisition, {
                foreignKey: "rfqId",
                as: "Requisition",
            });
            this.belongsTo(models.User, {
                foreignKey: "vendorId",
                as: "Vendor",
            });
            this.hasMany(models.NegotiationRound, {
                foreignKey: "negotiationId",
                as: "Rounds",
            });
        }
    }

    Negotiation.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            rfqId: DataTypes.INTEGER,
            vendorId: DataTypes.INTEGER,
            status: {
                type: DataTypes.ENUM("active", "completed", "failed"),
                defaultValue: "active",
            },
            round: {
                type: DataTypes.INTEGER,
                defaultValue: 1,
            },
            score: {
                type: DataTypes.FLOAT,
                defaultValue: 0.0,
            },
        },
        {
            sequelize,
            tableName: "Negotiations",
            timestamps: true,
        }
    );

    return Negotiation;
};

export default negotiationModel;
