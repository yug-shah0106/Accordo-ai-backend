import models from "../../models/index.js";

const repo = {
  createProduct: async (productData) => {
    return models.Product.create(productData);
  },

  getAllProducts: async (userId) => {
    if (userId) {
      const user = await models.User.findByPk(userId);
      if (user?.companyId) {
        return models.Product.findAll({ where: { companyId: user.companyId } });
      }
    }
    return models.Product.findAll();
  },

  getProducts: async (queryOptions = {}, userId) => {
    const options = { ...queryOptions };
    options.where = { ...(options.where || {}) };
    if (userId) {
      const user = await models.User.findByPk(userId);
      if (user?.companyId) {
        options.where.companyId = user.companyId;
      }
    }
    return models.Product.findAndCountAll(options);
  },

  getProduct: async ({ id }) => {
    return models.Product.findByPk(id);
  },

  deleteProduct: async ({ id }) => {
    return models.Product.destroy({ where: { id } });
  },

  updateProduct: async (productId, productData) => {
    return models.Product.update(productData, { where: { id: productId } });
  },
};

export default repo;
