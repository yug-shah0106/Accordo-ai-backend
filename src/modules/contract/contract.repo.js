import models from "../../models/index.js";

const repo = {
  getContractDetails: async (uniqueToken) => {
    return models.Contract.findOne({
      where: { uniqueToken },
      include: [
        {
          model: models.User,
          as: "Vendor",
          attributes: { exclude: ["password"] },
        },
        {
          model: models.Requisition,
          as: "Requisition",
          include: [
            {
              model: models.RequisitionProduct,
              as: "RequisitionProduct",
              include: {
                model: models.Product,
                as: "Product",
              },
            },
            {
              model: models.RequisitionAttachment,
              as: "RequisitionAttachment",
            },
          ],
        },
      ],
    });
  },

  createContract: async (contractData) => {
    return models.Contract.create(contractData);
  },

  getContract: async (contractId) => {
    return models.Contract.findByPk(contractId, {
      include: [
        {
          model: models.User,
          as: "Vendor",
          attributes: { exclude: ["password"] },
        },
        {
          model: models.Requisition,
          as: "Requisition",
        },
      ],
    });
  },

  getContractByToken: async (uniqueToken) => {
    return models.Contract.findOne({ where: { uniqueToken } });
  },

  getContracts: async (queryOptions) => {
    const options = {
      ...queryOptions,
      include: [
        {
          model: models.User,
          as: "Vendor",
          attributes: { exclude: ["password"] },
        },
        {
          model: models.Requisition,
          as: "Requisition",
        },
      ],
      distinct: true,
    };

    return models.Contract.findAndCountAll(options);
  },

  deleteContract: async (contractId) => {
    return models.Contract.destroy({ where: { id: contractId } });
  },

  updateContractByToken: async (uniqueToken, contractData) => {
    return models.Contract.update(contractData, { where: { uniqueToken } });
  },

  updateContract: async (contractId, contractData) => {
    return models.Contract.update(contractData, { where: { id: contractId } });
  },

  updateContractByRequisitionAndVendor: async (requisitionId, vendorId, contractData) => {
    return models.Contract.update(contractData, {
      where: { requisitionId, vendorId },
    });
  },
};

export default repo;
