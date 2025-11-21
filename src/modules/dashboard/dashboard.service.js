import { Op } from "sequelize";

import repo from "./dashboard.repo.js";
import userRepo from "../user/user.repo.js";
import CustomError from "../../utils/custom-error.js";

const DAYS_IN_YEAR = 365;

const parseNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const calculateActualPrice = (requisition) => {
  const products = new Map();
  (requisition.RequisitionProduct || []).forEach((product) => {
    products.set(product.productId, parseNumber(product.qty));
  });

  let total = 0;
  (requisition.Contract || []).forEach((contract) => {
    if (contract.status !== "Accepted") {
      return;
    }

    const details = (() => {
      if (!contract.contractDetails) {
        return [];
      }
      if (Array.isArray(contract.contractDetails)) {
        return contract.contractDetails;
      }
      try {
        const parsed = JSON.parse(contract.contractDetails);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    })();

    details.forEach((detail) => {
      const qty = products.get(detail.productId) ?? 0;
      const price = parseNumber(detail.Price ?? detail.price);
      total += qty * price;
    });
  });

  return total;
};

const groupBy = (array, keyFn) => {
  const map = new Map();
  array.forEach((item) => {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
};

const formatDate = (date) => new Date(date).toISOString().slice(0, 10);

const getWeekOfYear = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return week;
};

const buildTimeWiseCounts = (requisitions, dayYear) => {
  const parsedDayYear = Number.parseInt(dayYear, 10);
  const deliveryDates = requisitions.map((req) => new Date(req.deliveryDate));

  if (parsedDayYear === 1) {
    const monthly = groupBy(deliveryDates, (date) => date.toISOString().slice(0, 7));
    return Array.from(monthly.entries()).map(([delivery_month, requisition_count]) => ({
      delivery_month,
      requisition_count,
    }));
  }

  if (parsedDayYear === 5) {
    const yearly = groupBy(deliveryDates, (date) => date.getUTCFullYear());
    return Array.from(yearly.entries()).map(([delivery_year, requisition_count]) => ({
      delivery_year,
      requisition_count,
    }));
  }

  const daily = groupBy(deliveryDates, (date) => formatDate(date));
  const weekly = groupBy(deliveryDates, (date) => getWeekOfYear(date));

  return {
    dailyReqCount: Array.from(daily.entries()).map(([delivery_date, requisition_count]) => ({
      delivery_date,
      requisition_count,
    })),
    weeklyReqCount: Array.from(weekly.entries()).map(([delivery_week, requisition_count]) => ({
      delivery_week,
      requisition_count,
    })),
  };
};

const buildCategorySummary = (requisitions) => {
  const categoryTotals = new Map();
  requisitions.forEach((req) => {
    const category = req.category || "Unknown";
    const current = categoryTotals.get(category) || { total_price: 0, actual_price: 0 };
    current.total_price += parseNumber(req.totalPrice);
    current.actual_price += calculateActualPrice(req);
    categoryTotals.set(category, current);
  });

  return Array.from(categoryTotals.entries()).map(([category, values]) => ({
    category,
    total_price: values.total_price,
    actual_price: values.actual_price,
  }));
};

const buildStatusCounts = (requisitions) => {
  const counts = groupBy(requisitions, (req) => req.status || "Unknown");
  return Array.from(counts.entries()).map(([status, requisition_count]) => ({
    status,
    requisition_count,
  }));
};

const buildRfqSummaries = (requisitions) => {
  const sorted = [...requisitions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const latest = sorted.slice(0, 2);

  const totalPriceRfq = latest.map((req) => ({
    rfqId: req.rfqId,
    totalPrice: parseNumber(req.totalPrice),
  }));

  const actualPriceRfq = latest.map((req) => ({
    rfqId: req.rfqId,
    actualPrice: calculateActualPrice(req),
  }));

  const priceSavingRfq = totalPriceRfq.map((item, index) => ({
    rfqId: item.rfqId,
    savingPrice: item.totalPrice - (actualPriceRfq[index]?.actualPrice ?? 0),
  }));

  return { totalPriceRfq, actualPriceRfq, priceSavingRfq };
};

const computeTotals = (requisitions) => {
  let totalBudget = 0;
  let actualPrice = 0;

  requisitions.forEach((req) => {
    const hasAcceptedContract = (req.Contract || []).some((contract) => contract.status === "Accepted");
    if (!hasAcceptedContract) {
      return;
    }
    totalBudget += parseNumber(req.totalPrice);
    actualPrice += calculateActualPrice(req);
  });

  return { totalBudget, actualPrice, totalSaving: totalBudget - actualPrice };
};

const getStartDate = (dayYear) => {
  const now = new Date();
  const parsed = Number.parseInt(dayYear, 10);
  if (parsed === 1 || parsed === 5) {
    const years = parsed;
    now.setUTCDate(now.getUTCDate() - years * DAYS_IN_YEAR);
    return now;
  }
  now.setUTCDate(now.getUTCDate() - 30);
  return now;
};

export const getDashboardService = async (userId, dayYear) => {
  try {
    const user = await userRepo.getUserProfile(userId);
    if (!user?.companyId) {
      throw new CustomError("User company not found", 404);
    }

    const fromDate = getStartDate(dayYear);
    const requisitions = await repo.findRequisitionsForCompany(user.companyId, fromDate);
    const plainRequisitions = requisitions.map((req) => req.get({ plain: true }));

    const totals = computeTotals(plainRequisitions);
    const rfqIds = buildRfqSummaries(plainRequisitions);
    const categorySummary = buildCategorySummary(plainRequisitions);
    const statusSummary = buildStatusCounts(plainRequisitions);
    const timeWise = buildTimeWiseCounts(plainRequisitions, dayYear);

    return {
      getCategoryWiseRequisitionTotalPrice: categorySummary,
      statusWiseReqCount: statusSummary,
      timeWiseRequisitionCount: timeWise,
      rfqIds,
      totalBudget: totals.totalBudget,
      actualPrice: totals.actualPrice,
      totalSaving: totals.totalSaving,
    };
  } catch (error) {
    throw new CustomError(`Service ${error}`, 400);
  }
};
