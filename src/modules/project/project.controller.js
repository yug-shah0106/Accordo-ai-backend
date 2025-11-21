import {
  createProjectService,
  deleteProjectService,
  getProjectsService,
  getProjectService,
  updateProjectService,
} from "./project.service.js";

export const createProject = async (req, res, next) => {
  try {
    const { pointOfContact = [] } = req.body;
    const data = await createProjectService(req.context.userId, pointOfContact, req.body);
    res.status(201).json({ message: "Project created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getProject = async (req, res, next) => {
  try {
    const data = await getProjectService(req.params.projectid);
    res.status(201).json({ message: "Project", data });
  } catch (error) {
    next(error);
  }
};

export const getAllProjects = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 10, filters } = req.query;
    const data = await getProjectsService(search, page, limit, req.context.userId, filters);
    res.status(201).json({ message: "Projects", ...data });
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req, res, next) => {
  try {
    const { pointOfContact = [] } = req.body;
    const data = await updateProjectService(
      req.params.projectid,
      req.context.userId,
      req.body,
      pointOfContact
    );
    res.status(201).json({ message: "Project updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const deleteProject = async (req, res, next) => {
  try {
    const data = await deleteProjectService(req.params.projectid);
    res.status(201).json({ message: "Project deleted successfully", data });
  } catch (error) {
    next(error);
  }
};
