import { Model, DataTypes } from "sequelize";

const projectModel = (sequelize) => {
  class Project extends Model {
    static associate(models) {
      this.belongsTo(models.Company, {
        foreignKey: "companyId",
        as: "Company",
      });
      this.hasMany(models.ProjectPoc, {
        foreignKey: "projectId",
        as: "ProjectPoc",
      });
      this.hasMany(models.Requisition, {
        foreignKey: "projectId",
        as: "Requisition",
      });
    }
  }

  Project.init(
    {
      projectName: DataTypes.STRING,
      projectId: {
        type: DataTypes.STRING,
        unique: true,
      },
      projectAddress: DataTypes.STRING,
      typeOfProject: DataTypes.STRING,
      tenureInDays: DataTypes.INTEGER,
      companyId: DataTypes.INTEGER,
    },
    {
      sequelize,
      tableName: "Projects",
      timestamps: true,
      underscored: false,
    }
  );

  Project.beforeCreate(async (project) => {
    if (!project.projectId) {
      const lastProject = await Project.findOne({
        order: [["createdAt", "DESC"]],
      });

      let next = 1;
      if (lastProject?.projectId) {
        const parsed = parseInt(lastProject.projectId.replace("PRO", ""), 10);
        if (!Number.isNaN(parsed)) {
          next = parsed + 1;
        }
      }

      project.projectId = `PRO${String(next).padStart(4, "0")}`;
    }
  });

  return Project;
};

export default projectModel;

