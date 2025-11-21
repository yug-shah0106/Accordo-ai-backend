import models from "../../models/index.js";

const repo = {
  getPermission: async (roleId) => {
    if (!roleId) {
      return null;
    }
    return models.RolePermission.findOne({ where: { roleId } });
  },
};

export default repo;
