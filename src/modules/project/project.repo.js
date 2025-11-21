import models, { sequelize } from "../../models/index.js";
import userRepo from "../user/user.repo.js";
import CustomError from "../../utils/custom-error.js";

const repo = {
  createProject: async (projectData) => {
    return models.Project.create(projectData);
  },

  createProjectPoc: async (projectId, userId, contact) => {
    return models.ProjectPoc.create({
      projectId,
      userId: contact,
      createdBy: userId,
    });
  },

  getProject: async (projectId) => {
    return models.Project.findByPk(projectId, {
      include: {
        model: models.ProjectPoc,
        as: "ProjectPoc",
        include: {
          model: models.User,
          as: "User",
        },
      },
    });
  },

  getProjects: async (queryOptions = {}, userId) => {
    const user = await userRepo.getUserProfile(userId);
    const options = {
      ...queryOptions,
      where: {
        ...(queryOptions.where || {}),
        ...(user?.companyId ? { companyId: user.companyId } : {}),
      },
      include: [
        {
          model: models.ProjectPoc,
          as: "ProjectPoc",
          include: {
            model: models.User,
            as: "User",
          },
        },
      ],
      distinct: true,
    };

    return models.Project.findAndCountAll(options);
  },

  deleteProject: async (projectId) => {
    const transaction = await sequelize.transaction();
    try {
      const requisitions = await models.Requisition.findAll({
        where: { projectId },
        attributes: ["id"],
        transaction,
      });
      const requisitionIds = requisitions.map((req) => req.id);

      if (requisitionIds.length) {
        await models.RequisitionAttachment.destroy({
          where: { requisitionId: requisitionIds },
          transaction,
        });
        await models.RequisitionProduct.destroy({
          where: { requisitionId: requisitionIds },
          transaction,
        });
        await models.Contract.destroy({
          where: { requisitionId: requisitionIds },
          transaction,
        });
        await models.Requisition.destroy({
          where: { projectId },
          transaction,
        });
      }

      await models.ProjectPoc.destroy({ where: { projectId }, transaction });
      const result = await models.Project.destroy({ where: { id: projectId }, transaction });

      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw new CustomError(error.message || error, 400);
    }
  },

  deleteProjectPoc: async (projectId) => {
    return models.ProjectPoc.destroy({ where: { projectId } });
  },

  updateProject: async (projectId, projectData) => {
    return models.Project.update(projectData, { where: { id: projectId } });
  },
};

export default repo;
