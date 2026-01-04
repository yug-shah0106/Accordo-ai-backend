import { literal } from 'sequelize';
import models from '../../models/index.js';
import type { Requisition } from '../../models/requisition.js';
import type { RequisitionProduct } from '../../models/requisitionProduct.js';
import type { RequisitionAttachment } from '../../models/requisitionAttachment.js';
import type { Transaction, WhereOptions } from 'sequelize';

export interface RequisitionData {
  projectId?: number;
  requisitionNumber?: string;
  requisitionName?: string;
  requisitionType?: string;
  shipTo?: string;
  deliveryDate?: Date;
  budgetedAmount?: number;
  status?: string;
  companyId?: number;
  productData?: any; // Can be array or JSON string
  [key: string]: any; // Allow additional properties from Requisition model
}

export interface RequisitionProductData {
  requisitionId?: number;
  productId?: number;
  quantity?: number;
  unitPrice?: number;
  gstType?: string;
  gstPercentage?: number;
  tds?: number;
  specification?: string;
}

export interface RequisitionAttachmentData {
  requisitionId?: number;
  filename?: string;
  filepath?: string;
  mimetype?: string;
  size?: number;
}

export interface RequisitionQueryOptions {
  where?: WhereOptions<Requisition>;
  limit?: number;
  offset?: number;
  order?: Array<[string, string]>;
  include?: any[];
  attributes?: any;
  having?: any;
  group?: string[];
  subQuery?: boolean;
}

export interface FindAndCountResult {
  rows: Requisition[];
  count: number;
}

const repo = {
  createRequisition: async (
    requisitionData: RequisitionData
  ): Promise<Requisition> => {
    return models.Requisition.create(requisitionData as any);
  },

  getAllRequisitions: async (userId?: number): Promise<Requisition[]> => {
    if (userId) {
      const user = await models.User.findByPk(userId);
      if (user?.companyId) {
        return models.Requisition.findAll({
          where: { companyId: user.companyId } as any,
        });
      }
    }
    return models.Requisition.findAll();
  },

  getRequisitions: async (
    queryOptions: RequisitionQueryOptions = {},
    userId?: number
  ): Promise<FindAndCountResult> => {
    const options = { ...queryOptions };
    options.where = { ...(options.where || {}) };

    if (userId) {
      const user = await models.User.findByPk(userId);
      if (user?.companyId) {
        (options.where as any).companyId = user.companyId;
      }
    }

    // Two-phase query for performance
    // First: Get count with contract aggregation
    const baseOptions: RequisitionQueryOptions = {
      attributes: [
        'id',
        [
          (models as any).sequelize.fn('COUNT', (models as any).sequelize.col('Contract.id')),
          'contractCount',
        ],
      ],
      include: [
        {
          model: models.Contract,
          as: 'Contract',
          attributes: [],
          required: false,
        },
      ],
      group: ['Requisition.id'],
      having: literal('COUNT("Contract"."id") > 0'),
      subQuery: false,
      where: options.where,
    };

    const countResult = await models.Requisition.findAll(baseOptions);
    const count = countResult.length;

    // Second: Get detailed data with pagination
    const detailOptions: RequisitionQueryOptions = {
      where: options.where,
      limit: options.limit,
      offset: options.offset,
      order: options.order || [['createdAt', 'DESC']],
      include: [
        {
          model: models.RequisitionProduct,
          as: 'RequisitionProduct',
          include: [
            {
              model: models.Product,
              as: 'Product',
            },
          ],
        },
        {
          model: models.RequisitionAttachment,
          as: 'RequisitionAttachment',
        },
        {
          model: models.Contract,
          as: 'Contract',
        },
        {
          model: models.Project,
          as: 'Project',
        },
      ],
    };

    const rows = await models.Requisition.findAll(detailOptions);

    return { rows, count };
  },

  getRequisition: async ({
    id,
  }: {
    id: number;
  }): Promise<Requisition | null> => {
    return models.Requisition.findByPk(id, {
      include: [
        {
          model: models.RequisitionProduct,
          as: 'RequisitionProduct',
          include: [
            {
              model: models.Product,
              as: 'Product',
            },
          ],
        },
        {
          model: models.RequisitionAttachment,
          as: 'RequisitionAttachment',
        },
        {
          model: models.Contract,
          as: 'Contract',
        },
        {
          model: models.Project,
          as: 'Project',
        },
      ],
    });
  },

  deleteRequisition: async ({ id }: { id: number }): Promise<number> => {
    return models.Requisition.destroy({ where: { id } });
  },

  updateRequisition: async (
    requisitionId: number,
    requisitionData: RequisitionData
  ): Promise<[affectedCount: number]> => {
    const [count] = await models.Requisition.update(requisitionData as any, {
      where: { id: requisitionId },
    });
    return [count];
  },

  createRequisitionProduct: async (
    productData: RequisitionProductData
  ): Promise<RequisitionProduct> => {
    return models.RequisitionProduct.create(productData);
  },

  updateRequisitionProduct: async (
    requisitionProductId: number,
    productData: RequisitionProductData
  ): Promise<[affectedCount: number]> => {
    return models.RequisitionProduct.update(productData, {
      where: { id: requisitionProductId },
    });
  },

  deleteRequisitionProduct: async ({
    id,
  }: {
    id: number;
  }): Promise<number> => {
    return models.RequisitionProduct.destroy({ where: { id } });
  },

  createRequisitionAttachment: async (
    attachmentData: RequisitionAttachmentData
  ): Promise<RequisitionAttachment> => {
    return models.RequisitionAttachment.create(attachmentData);
  },

  deleteRequisitionAttachment: async ({
    id,
  }: {
    id: number;
  }): Promise<number> => {
    return models.RequisitionAttachment.destroy({ where: { id } });
  },

  deleteRequisitionAttachments: async (
    requisitionId: number,
    transaction?: Transaction
  ): Promise<number> => {
    return models.RequisitionAttachment.destroy({
      where: { requisitionId },
      transaction,
    });
  },

  deleteRequisitionProducts: async (
    requisitionId: number,
    transaction?: Transaction
  ): Promise<number> => {
    return models.RequisitionProduct.destroy({
      where: { requisitionId },
      transaction,
    });
  },
};

export default repo;
