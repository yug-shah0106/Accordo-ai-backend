import { Op, literal } from "sequelize";
import models, { sequelize } from "../../models/index.js";
import CustomError from "../../utils/custom-error.js";

const repo = {
  createRequisition: async (requisitionData) => {
    return models.Requisition.create(requisitionData);
  },

  createRequisitionProduct: async (
    requisitionId,
    productId,
    targetPrice,
    qty,
    maximum_price,
    createdBy
  ) => {
    return models.RequisitionProduct.create({
      requisitionId,
      productId,
      targetPrice,
      qty,
      maximum_price,
      createdBy,
    });
  },

  createRequisitionAttachment: async (requisitionId, attachmentUrl, createdBy) => {
    return models.RequisitionAttachment.create({
      requisitionId,
      attachmentUrl,
      createdBy,
    });
  },

  getRequisition: async (requisitionId) => {
    return models.Requisition.findByPk(requisitionId, {
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
        {
          model: models.Contract,
          as: "Contract",
        },
      ],
    });
  },

  getProjectIdsByCompanyId: async (companyId) => {
    const projects = await models.Project.findAll({
      where: { companyId },
      attributes: ["id"],
    });
    return projects.map((project) => project.id);
  },

  getRequisitions: async (projectIds, queryOptions) => {
    const whereClause = {
      ...(queryOptions.where || {}),
    };

    if (Array.isArray(projectIds)) {
      whereClause.projectId = { [Op.in]: projectIds };
    } else if (projectIds) {
      whereClause.projectId = projectIds;
    }

    const baseOptions = {
      ...queryOptions,
      where: whereClause,
      attributes: [
        "id",
        [sequelize.fn("COUNT", sequelize.col("Contract.id")), "contractCount"],
      ],
      include: [
        {
          model: models.Contract,
          as: "Contract",
          attributes: [],
        },
      ],
      group: ["Requisition.id"],
      duplicating: false,
      subQuery: false,
      distinct: true,
      having: literal('COUNT("Contract"."id") > 0'),
    };

    const responseCount = await models.Requisition.findAndCountAll(baseOptions);
    const ids = responseCount.rows.map((row) => row.id);

    const detailedOptions = {
      ...queryOptions,
      where: {
        ...whereClause,
        id: ids,
      },
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
        {
          model: models.Contract,
          as: "Contract",
          include: {
            model: models.User,
            as: "Vendor",
            attributes: { exclude: ["password"] },
          },
        },
        {
          model: models.Project,
          as: "Project",
        },
      ],
    };

    delete detailedOptions.offset;
    delete detailedOptions.limit;
    delete detailedOptions.group;
    delete detailedOptions.having;
    delete detailedOptions.attributes;
    delete detailedOptions.distinct;
    delete detailedOptions.subQuery;
    delete detailedOptions.duplicating;

    const detailedRows = await models.Requisition.findAll(detailedOptions);
    const data = detailedRows.map((item) => ({
      ...item.toJSON(),
      contractCount:
        responseCount.rows.find((row) => row.id === item.id)?.get("contractCount") ?? null,
    }));

    const totalCount = Array.isArray(responseCount.count)
      ? responseCount.count.length
      : responseCount.count;

    return { rows: data, count: totalCount };
  },

  updateRequisition: async (requisitionId, requisitionData) => {
    return models.Requisition.update(requisitionData, {
      where: { id: requisitionId },
    });
  },

  deleteRequisitionProduct: async (requisitionId) => {
    return models.RequisitionProduct.destroy({ where: { requisitionId } });
  },

  deleteRequisitionAttachment: async (requisitionId) => {
    return models.RequisitionAttachment.destroy({ where: { requisitionId } });
  },

  deleteRequisition: async (requisitionId) => {
    try {
      return models.Requisition.update(
        { status: "Cancelled" },
        { where: { id: requisitionId } }
      );
    } catch (error) {
      throw new CustomError(`Repo ${error}`, 400);
    }
  },
};

export default repo;
