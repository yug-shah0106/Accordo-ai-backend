import { QueryTypes } from "sequelize";
import models, { sequelize } from "../../models/index.js";

const applyFilters = (rows, queryOptions) => {
  let filtered = rows.slice();

  if (queryOptions.search) {
    const term = queryOptions.search.toLowerCase();
    filtered = filtered.filter((row) =>
      row.Vendor?.name?.toLowerCase().includes(term)
    );
  }

  if (queryOptions.vendorStatusList?.length) {
    const statuses = queryOptions.vendorStatusList.map((s) => s.toLowerCase());
    filtered = filtered.filter((row) =>
      statuses.includes((row.Vendor?.status || "").toLowerCase())
    );
  }

  if (queryOptions.totalContractsRange) {
    const [min, max] = queryOptions.totalContractsRange;
    filtered = filtered.filter((row) => {
      const count = row.Vendor?.contractCount ?? 0;
      return count >= min && count <= max;
    });
  }

  if (queryOptions.completedContractsRange) {
    const [min, max] = queryOptions.completedContractsRange;
    filtered = filtered.filter((row) => {
      const count = row.Vendor?.approvedContractCount ?? 0;
      return count >= min && count <= max;
    });
  }

  return filtered;
};

const paginateRows = (rows, limit, offset) => {
  if (!Number.isInteger(limit) || limit <= 0) {
    return rows;
  }
  const start = Number.isInteger(offset) && offset > 0 ? offset : 0;
  return rows.slice(start, start + limit);
};

const repo = {
  createVendor: async (vendorData) => {
    return models.User.create({ ...vendorData, userType: "vendor" });
  },

  createVendorCompany: async (vendorData) => {
    return models.VendorCompany.create(vendorData);
  },

  getAllVendorCompany: async (companyId, queryOptions = {}) => {
    const include = {
      model: models.Vendor,
      as: "Vendor",
      attributes: ["id", "name", "email", "phone", "companyId", "roleId", "status"],
      include: [
        {
          model: models.Company,
          as: "Company",
          attributes: ["id", "companyName", "fullAddress", "pocPhone", "pocEmail"],
        },
      ],
    };

    const vendorCompanies = await models.VendorCompany.findAll({
      where: { companyId },
      include,
    });

    const countQuery = `
      SELECT 
        vc.id,
        vc.vendorId,
        COUNT(DISTINCT c.id) AS "contractCount",
        COUNT(DISTINCT CASE WHEN c.status = 'Accepted' THEN c.id END) AS "approvedContractCount"
      FROM "VendorCompanies" vc
      LEFT JOIN "User" v ON v.id = vc."vendorId"
      LEFT JOIN "Contracts" c ON c."vendorId" = v.id
      WHERE vc."companyId" = :companyId
      GROUP BY vc.id, vc."vendorId";
    `;

    const vendorCounts = await sequelize.query(countQuery, {
      replacements: { companyId },
      type: QueryTypes.SELECT,
    });

    const countMap = vendorCounts.reduce((acc, curr) => {
      acc[curr.vendorId] = {
        contractCount: Number.parseInt(curr.contractCount, 10) || 0,
        approvedContractCount: Number.parseInt(curr.approvedContractCount, 10) || 0,
      };
      return acc;
    }, {});

    const rows = vendorCompanies.map((item) => {
      const vendor = item.Vendor;
      return {
        id: item.id,
        vendorId: item.vendorId,
        Vendor: {
          id: vendor?.id,
          name: vendor?.name,
          email: vendor?.email,
          phone: vendor?.phone,
          companyId: vendor?.companyId,
          roleId: vendor?.roleId,
          status: vendor?.status,
          contractCount: countMap[vendor?.id]?.contractCount ?? 0,
          approvedContractCount: countMap[vendor?.id]?.approvedContractCount ?? 0,
          Company: vendor?.Company
            ? {
                id: vendor.Company.id,
                companyName: vendor.Company.companyName,
              }
            : null,
        },
      };
    });

    const filteredRows = applyFilters(rows, queryOptions);
    const total = filteredRows.length;
    const paginatedRows = paginateRows(filteredRows, queryOptions.limit, queryOptions.offset);

    const statsQuery = `
      SELECT 
        COALESCE(COUNT(*), 0) AS "totalVendors",
        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS "activeActiveVendors",
        COALESCE(SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END), 0) AS "totalInactiveVendors"
      FROM "User"
      WHERE "companyId" = :companyId AND "userType" = 'vendor';
    `;

    const [stats] = await sequelize.query(statsQuery, {
      replacements: { companyId },
      type: QueryTypes.SELECT,
    });

    return {
      response: {
        rows: paginatedRows,
        count: total,
      },
      vendorCount: {
        totalVendors: Number.parseInt(stats?.totalVendors, 10) || 0,
        activeActiveVendors: Number.parseInt(stats?.activeActiveVendors, 10) || 0,
        totalInactiveVendors: Number.parseInt(stats?.totalInactiveVendors, 10) || 0,
      },
    };
  },

  getVendors: async (companyId) => {
    return models.User.findAll({
      where: { companyId, userType: "vendor" },
      include: {
        model: models.Company,
        as: "Company",
      },
    });
  },

  getVendor: async ({ id }) => {
    return models.User.findByPk(id, {
      include: {
        model: models.Company,
        as: "Company",
      },
    });
  },

  deleteVendor: async ({ id }) => {
    return models.User.destroy({ where: { id } });
  },

  updateVendor: async (vendorId, vendorData) => {
    return models.User.update(vendorData, { where: { id: vendorId } });
  },
};

export default repo;
