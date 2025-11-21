import { Op } from "sequelize";
import CustomError from "../../utils/custom-error.js";
import repo from "./po.repo.js";
import companyRepo from "../company/company.repo.js";
import vendorRepo from "../vendor/vendor.repo.js";
import productRepo from "../product/product.repo.js";
import userRepo from "../user/user.repo.js";
import util from "../common/util.js";

const pad = (num, size) => {
  let str = `${num}`;
  while (str.length < size) str = `0${str}`;
  return str;
};

const generatePoNumber = (company = {}, vendor = {}, companyVendorPos) => {
  const prefix = (company.companyName || "").substring(0, 3).toUpperCase();
  const middle = (vendor.name || "").substring(0, 3).toUpperCase();
  if (companyVendorPos?.length) {
    const lastPo = companyVendorPos[companyVendorPos.length - 1];
    const parts = lastPo.poNumber.split("/");
    const last = parseInt(parts[parts.length - 1], 10) + 1;
    return `${prefix}/${middle}/${pad(last, 3)}`;
  }
  return `${prefix}/${middle}/${pad(1, 3)}`;
};

export const getPoService = async (poId) => {
  try {
    return repo.getPo(poId);
  } catch (error) {
    throw new CustomError(error, 400);
  }
};

export const downloadPoService = async (poId) => {
  try {
    const po = await repo.getPo(poId);
    if (!po) {
      throw new CustomError("Po not found", 404);
    }
    const lineItems = JSON.parse(po.lineItems || "[]");
    const products = [];
    if (!Array.isArray(lineItems) || !lineItems.length) {
      throw new CustomError("At least one line item is required", 400);
    }

    for (const item of lineItems) {
      const product = await productRepo.getProduct({ id: item.productId });
      products.push(product);
    }
    const generator = await import("./po.create.js");
    return generator.createPo(po, lineItems, products);
  } catch (error) {
    throw new CustomError(error, 400);
  }
};

export const getAllPoService = async (search, page = 1, limit = 10, userId, filters) => {
  try {
    const offset = (page - 1) * limit;
    const queryOptions = {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      where: {},
    };

    if (userId) {
      const user = await userRepo.getUser(userId);
      if (user?.companyId) {
        queryOptions.where.companyId = user.companyId;
      }
    }

    if (search) {
      queryOptions.where.poNumber = {
        [Op.like]: `%${search}%`,
      };
    }

    if (filters) {
      const filterData = JSON.parse(decodeURIComponent(filters));
      queryOptions.where = {
        ...util.filterUtil(filterData),
        ...queryOptions.where,
      };
    }

    const { rows, count } = await repo.getPos(queryOptions);
    return {
      data: rows,
      total: count,
      page: parseInt(page, 10),
      totalPages: Math.ceil(count / limit),
    };
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const createPoService = async (poData) => {
  try {
    const lineItems =
      typeof poData.lineItems === "string"
        ? JSON.parse(poData.lineItems)
        : poData.lineItems || [];

    poData.subTotal = 0;
    poData.taxTotal = 0;
    poData.total = 0;

    for (const item of lineItems) {
      if (item.productId && item.qty && item.price) {
        const product = await productRepo.getProduct({ id: item.productId });
        const taxPercentage = product?.gstType === "GST" ? product.gstPercentage : 0;
        const subTotal = item.price * item.qty;
        const taxTotal = (subTotal * taxPercentage) / 100;
        const total = subTotal + taxTotal;

        poData.subTotal += subTotal;
        poData.taxTotal += taxTotal;
        poData.total += total;
      } else {
        throw new CustomError("Line item data missing", 400);
      }
    }

    const creator = await vendorRepo.getVendor({ id: poData.addedBy });
    if (!creator) {
      throw new CustomError("Creator not found", 404);
    }
    poData.companyId = creator.companyId;
    const vendor = await vendorRepo.getVendor({ id: poData.vendorId });
    const company = await companyRepo.getCompany(poData.companyId);

    if (!vendor) {
      throw new CustomError("Vendor not found", 404);
    }
    if (!company) {
      throw new CustomError("Company not found", 404);
    }

    const companyVendorPos = await repo.getAllPo(poData);
    poData.poNumber = generatePoNumber(company, vendor, companyVendorPos);
    poData.status = "Created";
    poData.lineItems = JSON.stringify(lineItems);

    return repo.createPo(poData);
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};

export const cancelPoService = async (poId) => {
  try {
    return repo.updatePo(poId, { status: "Cancelled" });
  } catch (error) {
    throw new CustomError(error, 400);
  }
};
