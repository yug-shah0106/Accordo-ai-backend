import models from "../../models/index.js";

const repo = {
  getCompanyByUser: async (userId) => {
    return models.Company.findOne({ where: { userId } });
  },
  createCompany: async (companyData = {}) => {
    return models.Company.create(companyData);
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
  updateCompany: async (companyId, companyData) => {
    return models.Company.update(companyData, { where: { id: companyId } });
  },
  deleteCompany: async (companyId) => {
    return models.Company.destroy({ where: { id: companyId } });
  },
};

export default repo;

