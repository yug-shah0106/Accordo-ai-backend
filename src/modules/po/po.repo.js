import models from "../../models/index.js";

const repo = {
  createPo: async (poData) => {
    return models.Po.create(poData);
  },

  getAllPo: async (poData) => {
    return models.Po.findAll({
      where: { vendorId: poData.vendorId, companyId: poData.companyId },
    });
  },

  getPo: async (poId) => {
    return models.Po.findByPk(poId, {
      include: [
        {
          model: models.Contract,
          as: "Contract",
        },
        {
          model: models.Requisition,
          as: "Requisition",
        },
        {
          model: models.Company,
          as: "Company",
        },
        {
          model: models.User,
          as: "Vendor",
          include: { model: models.Company, as: "Company" },
        },
      ],
    });
  },

  getPos: async (queryOptions) => {
    const options = {
      ...queryOptions,
      include: [
        {
          model: models.Contract,
          as: "Contract",
        },
        {
          model: models.Requisition,
          as: "Requisition",
        },
        {
          model: models.Company,
          as: "Company",
        },
        {
          model: models.User,
          as: "Vendor",
        },
      ],
      distinct: true,
    };
    return models.Po.findAndCountAll(options);
  },

  updatePo: async (poId, poData) => {
    return models.Po.update(poData, { where: { id: poId } });
  },
};

export default repo;
