import { Op } from "sequelize";
import repo from "./project.repo.js";
import userRepo from "../user/user.repo.js";
import CustomError from "../../utils/custom-error.js";
import util from "../common/util.js";

const parseNumber = (value, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const createProjectService = async (userId, pointOfContact = [], projectData) => {
  try {
    const user = await userRepo.getUser(userId);
    if (!user?.companyId) {
      throw new CustomError("User company not found", 400);
    }

    const payload = { ...projectData, companyId: user.companyId };
    const project = await repo.createProject(payload);

    await Promise.all(
      (pointOfContact || []).map((contact) => repo.createProjectPoc(project.id, userId, contact))
    );

    return project;
  } catch (error) {
    throw new CustomError(error.message || error, 400);
  }
};

export const getProjectService = async (projectId) => {
  try {
    return repo.getProject(projectId);
  } catch (error) {
    throw new CustomError(error, 400);
  }
};

export const getProjectsService = async (
  search,
  page = 1,
  limit = 10,
  userId,
  filters
) => {
  try {
    const parsedPage = parseNumber(page, 1);
    const parsedLimit = parseNumber(limit, 10);
    const offset = (parsedPage - 1) * parsedLimit;

    const queryOptions = {
      where: {},
      limit: parsedLimit,
      offset,
    };

    if (search) {
      queryOptions.where.projectName = {
        [Op.like]: `%${search}%`,
      };
    }

    if (filters) {
      const filterData = JSON.parse(decodeURIComponent(filters));
      const transformed = util.filterUtil(filterData);
      if (Object.keys(transformed).length) {
        queryOptions.where = transformed;
      }
    }

    const { rows, count } = await repo.getProjects(queryOptions, userId);
    return {
      data: rows,
      total: count,
      page: parsedPage,
      totalPages: parsedLimit ? Math.ceil(count / parsedLimit) : 1,
    };
  } catch (error) {
    throw new CustomError(error.message || error, 400);
  }
};

export const updateProjectService = async (
  projectId,
  userId,
  projectData,
  pointOfContact = []
) => {
  try {
    await repo.deleteProjectPoc(projectId);
    await Promise.all(
      (pointOfContact || []).map((contact) => repo.createProjectPoc(projectId, userId, contact))
    );
    return repo.updateProject(projectId, projectData);
  } catch (error) {
    throw new CustomError(error.message || error, 400);
  }
};

export const deleteProjectService = async (projectId) => {
  try {
    return repo.deleteProject(projectId);
  } catch (error) {
    throw new CustomError(error.message || error, 400);
  }
};
