import { Op } from "sequelize";
import models from "../../models/index.js";

const repo = {
  findRequisitionsForCompany: async (companyId, fromDate) => {
    return models.Requisition.findAll({
      where: {
        deliveryDate: {
          [Op.gte]: fromDate,
        },
      },
      include: [
        {
          model: models.Project,
          as: "Project",
          attributes: [],
          where: { companyId },
        },
        {
          model: models.Contract,
          as: "Contract",
        },
        {
          model: models.RequisitionProduct,
          as: "RequisitionProduct",
        },
      ],
      order: [["createdAt", "DESC"]],
      distinct: true,
    });
  },
};

export default repo;
