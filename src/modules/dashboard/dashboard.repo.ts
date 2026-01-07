import { Op } from 'sequelize';
import models from '../../models/index.js';
import type { Requisition } from '../../models/requisition.js';

const repo = {
  findRequisitionsForCompany: async (
    companyId: number,
    fromDate: Date
  ): Promise<Requisition[]> => {
    return models.Requisition.findAll({
      where: {
        deliveryDate: {
          [Op.gte]: fromDate,
        },
      },
      include: [
        {
          model: models.Project,
          as: 'Project',
          attributes: [],
          where: { companyId },
        },
        {
          model: models.Contract,
          as: 'Contract',
        },
        {
          model: models.RequisitionProduct,
          as: 'RequisitionProduct',
        },
      ],
      order: [['createdAt', 'DESC']],
      subQuery: false,
    });
  },
};

export default repo;
