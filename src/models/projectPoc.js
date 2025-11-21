import { Model, DataTypes } from "sequelize";

export default function projectPocModel(sequelize) {
  class ProjectPoc extends Model {
    static associate(models) {
      this.belongsTo(models.Project, {
        foreignKey: "projectId",
        as: "Project",
      });
      this.belongsTo(models.User, {
        foreignKey: "userId",
        as: "User",
      });
      this.belongsTo(models.User, {
        foreignKey: "createdBy",
        as: "Creator",
      });
    }
  }

  ProjectPoc.init(
    {
      projectId: DataTypes.INTEGER,
      userId: DataTypes.INTEGER,
      createdBy: DataTypes.INTEGER,
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: "ProjectPocs",
      timestamps: true,
      underscored: false,
      updatedAt: false,
    }
  );

  return ProjectPoc;
}
