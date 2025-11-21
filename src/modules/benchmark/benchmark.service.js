import axios from "axios";

import CustomError from "../../utils/custom-error.js";
import requisitionRepo from "../requisition/requisition.repo.js";
import contractRepo from "../contract/contract.repo.js";
import { validateCreateBenchmark } from "./benchmark.validator.js";

const BENCHMARK_API_URL = "https://model.accordo.ai/bm/create/";

const calculateAverageRatingPerVendor = (data) => {
  const vendorRatings = {};

  if (!data || !data.VendorComparison) {
    return vendorRatings;
  }

  for (const productName of Object.keys(data.VendorComparison)) {
    const productVendors = data.VendorComparison[productName] || [];

    for (const vendor of productVendors) {
      if (!vendor || typeof vendor !== "object" || !vendor.ContractDetails) {
        continue;
      }

      const vendorId = vendor.VendorId;
      if (!vendorRatings[vendorId]) {
        vendorRatings[vendorId] = { totalRating: 0, totalItems: 0 };
      }

      for (const contractDetail of vendor.ContractDetails) {
        const rating = parseFloat(contractDetail?.rating);
        if (!Number.isNaN(rating)) {
          vendorRatings[vendorId].totalRating += rating;
          vendorRatings[vendorId].totalItems += 1;
        }
      }
    }
  }

  const averages = {};
  for (const vendorId of Object.keys(vendorRatings)) {
    const { totalRating, totalItems } = vendorRatings[vendorId];
    averages[vendorId] = totalItems === 0 ? 0 : totalRating / totalItems;
  }

  return averages;
};

const extractContractDetails = (contract, type) => {
  const sourceField = type ? contract.finalContractDetails : contract.contractDetails;
  if (!sourceField) {
    return null;
  }

  if (Array.isArray(sourceField)) {
    return sourceField;
  }

  try {
    const parsed = JSON.parse(sourceField);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
};

export const createBenchmarkService = async (benchmarkData, type) => {
  const { error } = validateCreateBenchmark(benchmarkData);
  if (error) {
    throw new CustomError(error.details[0].message, 400);
  }

  const { requisitionId, userId } = benchmarkData;
  const requisition = await requisitionRepo.getRequisition(requisitionId);

  if (!requisition) {
    throw new CustomError("Requisition not found", 404);
  }

  const contracts = requisition.Contract || [];
  if (!contracts.length) {
    throw new CustomError("Requisition has no contracts", 400);
  }

  if (!type) {
    const hasInitialQuotation = contracts.some((contract) => contract.status === "InitialQuotation");
    if (!hasInitialQuotation) {
      throw new CustomError("Requisition has no InitialQuotations", 400);
    }
  }

  const nonEmptyContracts = [];
  for (const contract of contracts) {
    const details = extractContractDetails(contract, type);
    if (details && details.length) {
      nonEmptyContracts.push({
        ...contract.toJSON?.() ?? contract,
        ContractDetails: details,
      });
    }
  }

  if (!nonEmptyContracts.length) {
    throw new CustomError("No contract details available for benchmarking", 400);
  }

  const payload = {
    requisition,
    contracts: nonEmptyContracts,
  };

  let apiResponse;
  try {
    apiResponse = await axios.post(BENCHMARK_API_URL, payload, {
      timeout: 30_000,
    });
  } catch (apiError) {
    throw new CustomError(`Benchmark service error: ${apiError.message}`, 502);
  }

  const averageRatingByVendor = calculateAverageRatingPerVendor(apiResponse.data);
  await Promise.all(
    Object.entries(averageRatingByVendor).map(([vendorId, rating]) =>
      contractRepo.updateContractByRequisitionAndVendor(requisitionId, vendorId, {
        rating,
      })
    )
  );

  const finalBenchmarkResult = {
    VendorComparison: apiResponse.data?.VendorComparison,
    FinalBenchmark: apiResponse.data?.FinalBenchmark,
    Explanation: apiResponse.data?.Explanation,
  };

  const updateData = type
    ? {}
    : {
        benchmarkResponse: JSON.stringify(finalBenchmarkResult),
        benchmarkedAt: new Date(),
        benchmarkedBy: userId,
        status: "Benchmarked",
      };

  if (Object.keys(updateData).length) {
    await requisitionRepo.updateRequisition(requisitionId, updateData);
  }

  const updatedRequisition = await requisitionRepo.getRequisition(requisitionId);

  return {
    benchmarkedAt: updatedRequisition?.benchmarkedAt,
    benchmarkedBy: updatedRequisition?.benchmarkedBy,
    status: updatedRequisition?.status,
    benchmarkResponse: updatedRequisition?.benchmarkResponse,
    finalBenchmarkResult,
  };
};
