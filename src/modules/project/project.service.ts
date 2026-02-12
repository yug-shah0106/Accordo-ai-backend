import { Op } from 'sequelize';
import repo from './project.repo.js';
import userRepo from '../user/user.repo.js';
import CustomError from '../../utils/custom-error.js';
import util from '../common/util.js';

/**
 * Interface for project data
 */
interface ProjectData {
  projectName?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  status?: string;
  [key: string]: unknown;
}

/**
 * Interface for paginated response
 */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Parse string or number to valid integer
 */
const parseNumber = (value: string | number | undefined, fallback = 1): number => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

/**
 * Create a new project with point of contacts
 */
export const createProjectService = async (
  userId: number,
  pointOfContact: number[] = [],
  projectData: ProjectData
): Promise<any> => {
  try {
    const user = await userRepo.getUser(userId);
    if (!user?.companyId) {
      throw new CustomError('User company not found', 400);
    }

    // Remove pointOfContact from projectData as it's not a model field
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pointOfContact: _poc, ...cleanProjectData } = projectData as ProjectData & { pointOfContact?: number[] };

    const payload = { ...cleanProjectData, companyId: user.companyId };
    const project = await repo.createProject(payload);

    await Promise.all(
      (pointOfContact || []).map((contact) => repo.createProjectPoc(project.id, userId, contact))
    );

    return project;
  } catch (error) {
    const err = error as Error & { name?: string; errors?: Array<{ message: string }> };
    // Provide more specific error messages for Sequelize errors
    if (err.name === 'SequelizeUniqueConstraintError') {
      throw new CustomError('A project with this ID already exists', 400);
    }
    if (err.name === 'SequelizeValidationError' && err.errors?.length) {
      throw new CustomError(err.errors.map(e => e.message).join(', '), 400);
    }
    throw new CustomError(err.message || String(error), 400);
  }
};

/**
 * Get a single project by ID
 */
export const getProjectService = async (projectId: string): Promise<any> => {
  try {
    return repo.getProject(projectId);
  } catch (error) {
    throw new CustomError(String(error), 400);
  }
};

/**
 * Get all projects with pagination and filtering
 */
export const getProjectsService = async (
  search: string | undefined,
  page: string | number = 1,
  limit: string | number = 10,
  userId: number,
  filters: string | undefined
): Promise<PaginatedResponse<any>> => {
  try {
    const parsedPage = parseNumber(page, 1);
    const parsedLimit = parseNumber(limit, 10);
    const offset = (parsedPage - 1) * parsedLimit;

    const queryOptions: Record<string, unknown> = {
      where: {},
      limit: parsedLimit,
      offset,
    };

    if (search) {
      // Multi-field OR search: Project ID, Project Name, Business Category, Tenure
      // Note: POC search is handled via include in repo
      const searchConditions: Record<string, unknown>[] = [
        { projectId: { [Op.iLike]: `%${search}%` } },
        { projectName: { [Op.iLike]: `%${search}%` } },
        { typeOfProject: { [Op.iLike]: `%${search}%` } },
      ];

      // If search is a number, also search by tenure
      const numericSearch = Number(search);
      if (!isNaN(numericSearch)) {
        searchConditions.push({ tenureInDays: numericSearch });
      }

      (queryOptions.where as Record<string, unknown>)[Op.or as unknown as string] = searchConditions;
    }

    if (filters) {
      try {
        const filterData = JSON.parse(decodeURIComponent(filters));
        const transformed = util.filterUtil(filterData);
        if (Object.keys(transformed).length) {
          queryOptions.where = transformed;
        }
      } catch (error) {
        throw new CustomError('Invalid filters format', 400);
      }
    }

    const { rows, count } = await repo.getProjects(queryOptions, userId, search);
    return {
      data: rows,
      total: count,
      page: parsedPage,
      totalPages: parsedLimit ? Math.ceil(count / parsedLimit) : 1,
    };
  } catch (error) {
    const err = error as Error;
    throw new CustomError(err.message || String(error), 400);
  }
};

/**
 * Update an existing project and its point of contacts
 */
export const updateProjectService = async (
  projectId: string,
  userId: number,
  projectData: ProjectData,
  pointOfContact: number[] = []
): Promise<any> => {
  try {
    await repo.deleteProjectPoc(projectId);
    await Promise.all(
      (pointOfContact || []).map((contact) => repo.createProjectPoc(projectId, userId, contact))
    );
    return repo.updateProject(projectId, projectData);
  } catch (error) {
    const err = error as Error;
    throw new CustomError(err.message || String(error), 400);
  }
};

/**
 * Delete a project (cascades to requisitions, contracts, etc.)
 */
export const deleteProjectService = async (projectId: string): Promise<any> => {
  try {
    return repo.deleteProject(projectId);
  } catch (error) {
    const err = error as Error;
    throw new CustomError(err.message || String(error), 400);
  }
};
