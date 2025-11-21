import repo from "./role.repo.js";
import userRepo from "../user/user.repo.js";
import CustomError from "../../utils/custom-error.js";

const createPermissionArray = (roleData, createdRole) => {
  const roleId = createdRole.id;
  let count = 1;
  const permissionsArray = [];
  for (const permission of roleData.permissions || []) {
    permissionsArray.push({
      roleId,
      moduleId: count,
      permission,
    });
    count += 1;
  }
  return permissionsArray;
};

export const createRoleService = async (roleData, userData) => {
  try {
    const roleTableData = {
      name: roleData.name,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userData.id,
      updatedBy: userData.id,
      companyId: userData.companyId,
      isArchived: false,
    };
    const createRoleResponse = await repo.createRole(roleTableData);
    const permissionsArray = createPermissionArray(roleData, createRoleResponse);
    if (permissionsArray.length) {
      await repo.createRolePermission(permissionsArray);
    }
    return createRoleResponse;
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const getRolesService = async (companyId) => {
  try {
    return repo.getRoles(companyId);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const getRoleService = async (roleId) => {
  try {
    return repo.getRole(roleId);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const updateRoleService = async (roleId, roleData, userId) => {
  try {
    const roleTableData = {
      name: roleData.name,
      updatedAt: new Date(),
      updatedBy: userId,
    };
    const permissionsArray = createPermissionArray(roleData, { id: roleId });
    return repo.updateRole(roleId, roleTableData, permissionsArray);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const deleteRoleService = async (roleId) => {
  try {
    return repo.deleteRole(roleId);
  } catch (error) {
    throw new CustomError(`Service ${error}`);
  }
};

export const checkPermissionService = async (userId, moduleId, permission) => {
  if (moduleId >= 6 || permission >= 4) {
    throw new CustomError(`Incorrect module name or permission`, 401);
  }

  const user = await userRepo.getUser(userId);
  if (!user?.Role) {
    return true;
  }

  const rolePermission = user.Role.RolePermission;
  if (!rolePermission) {
    throw new CustomError(`You don't have permission - P`, 401);
  }

  for (const rp of rolePermission) {
    if (rp.moduleId === moduleId) {
      if (rp.permission >= permission) {
        return true;
      }
      return false;
    }
  }

  throw new CustomError(`You don't have permission - R`, 401);
};

