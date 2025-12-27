import models from "../../models/index.js";

const repo = {
  getCompanyByUser: async (userId) => {
    return models.Company.findOne({ where: { userId } });
  },
  createCompany: async (companyData = {}, transaction = null) => {
    return models.Company.create(companyData, { transaction });
  },
  getAllCompanies: async (queryOptions) => {
    return models.Company.findAndCountAll(queryOptions);
  },
  getCompany: async (companyId) => {
    return models.Company.findByPk(companyId, {
      include: {
        model: models.User,
        as: "Users",
      },
    });
  },
  updateCompany: async (companyId, companyData, transaction = null) => {
    return models.Company.update(companyData, { where: { id: companyId }, transaction });
  },
  deleteCompany: async (companyId) => {
    return models.Company.destroy({ where: { id: companyId } });
  },
};

export default repo;

