import { getUserService } from "../user/user.service.js";
import {
  createRoleService,
  getRolesService,
  deleteRoleService,
  updateRoleService,
  getRoleService,
} from "./role.service.js";

export const createRole = async (req, res, next) => {
  try {
    const userData = await getUserService(req.context.userId);
    const data = await createRoleService(req.body, userData);
    res.status(201).json({ message: "Role created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getAllRoles = async (req, res, next) => {
  try {
    const userData = await getUserService(req.context.userId);
    const data = await getRolesService(userData.companyId);
    res.status(201).json({ message: "Roles", data });
  } catch (error) {
    next(error);
  }
};

export const getRole = async (req, res, next) => {
  try {
    const data = await getRoleService(req.params.roleid);
    res.status(201).json({ message: "Role", data });
  } catch (error) {
    next(error);
  }
};

export const updateRole = async (req, res, next) => {
  try {
    const data = await updateRoleService(req.params.roleid, req.body, req.context.userId);
    res.status(201).json({ message: "Role updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const deleteRole = async (req, res, next) => {
  try {
    const data = await deleteRoleService(req.params.roleid);
    res.status(201).json({ message: "Role deleted successfully", data });
  } catch (error) {
    next(error);
  }
};
