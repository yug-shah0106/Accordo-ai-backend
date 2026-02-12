import axios from 'axios';
import { CustomError } from '../../utils/custom-error.js';
import requisitionRepo from '../requisition/requisition.repo.js';
import contractRepo from '../contract/contract.repo.js';
import { validateCreateBenchmark } from './benchmark.validator.js';
import type { Contract } from '../../models/contract.js';

const BENCHMARK_API_URL = 'https://model.accordo.ai/bm/create/';

export interface BenchmarkData {
  requisitionId: number;
  userId: number;
}

interface VendorRating {
  totalRating: number;
  totalItems: number;
}

interface ContractDetail {
  rating?: number;
}

interface VendorComparison {
  [productName: string]: Array<{
    VendorId: number;
    ContractDetails: ContractDetail[];
  }>;
}

interface BenchmarkApiResponse {
  VendorComparison: VendorComparison;
  FinalBenchmark: any;
  Explanation: any;
}

const calculateAverageRatingPerVendor = (data: BenchmarkApiResponse): Record<number, number> => {
  const vendorRatings: Record<number, VendorRating> = {};

  if (!data || !data.VendorComparison) {
    return {};
  }

  for (const productName of Object.keys(data.VendorComparison)) {
    const productVendors = data.VendorComparison[productName] || [];

    for (const vendor of productVendors) {
      if (!vendor || typeof vendor !== 'object' || !vendor.ContractDetails) {
        continue;
      }

      const vendorId = vendor.VendorId;
      if (!vendorRatings[vendorId]) {
        vendorRatings[vendorId] = { totalRating: 0, totalItems: 0 };
      }

      for (const contractDetail of vendor.ContractDetails) {
        const rating = Number.parseFloat(String(contractDetail?.rating));
        if (!Number.isNaN(rating)) {
          vendorRatings[vendorId].totalRating += rating;
          vendorRatings[vendorId].totalItems += 1;
        }
      }
    }
  }

  const averages: Record<number, number> = {};
  for (const vendorId of Object.keys(vendorRatings)) {
    const { totalRating, totalItems } = vendorRatings[Number(vendorId)];
    averages[Number(vendorId)] = totalItems === 0 ? 0 : totalRating / totalItems;
  }

  return averages;
};

const extractContractDetails = (
  contract: Contract,
  type?: string
): ContractDetail[] | null => {
  const sourceField = type ? contract.finalContractDetails : contract.contractDetails;
  if (!sourceField) {
    return null;
  }

  if (Array.isArray(sourceField)) {
    return sourceField;
  }

  try {
    const parsed = JSON.parse(sourceField as string);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
};

export const createBenchmarkService = async (
  benchmarkData: BenchmarkData,
  type?: string
) => {
  const { error } = validateCreateBenchmark(benchmarkData);
  if (error) {
    throw new CustomError(error.details[0].message, 400);
  }

  const { requisitionId, userId } = benchmarkData;
  const requisition = await requisitionRepo.getRequisition({ id: requisitionId });

  if (!requisition) {
    throw new CustomError('Requisition not found', 404);
  }

  const contracts = (requisition as any).Contract || [];
  if (!contracts.length) {
    throw new CustomError('Requisition has no contracts', 400);
  }

  if (!type) {
    const hasInitialQuotation = contracts.some(
      (contract: Contract) => contract.status === 'InitialQuotation'
    );
    if (!hasInitialQuotation) {
      throw new CustomError('Requisition has no InitialQuotations', 400);
    }
  }

  const nonEmptyContracts = [];
  for (const contract of contracts as Contract[]) {
    const details = extractContractDetails(contract, type);
    if (details && details.length) {
      nonEmptyContracts.push({
        ...(contract.toJSON?.() ?? contract),
        ContractDetails: details,
      });
    }
  }

  if (!nonEmptyContracts.length) {
    throw new CustomError('No contract details available for benchmarking', 400);
  }

  const payload = {
    requisition,
    contracts: nonEmptyContracts,
  };

  let apiResponse;
  try {
    apiResponse = await axios.post<BenchmarkApiResponse>(BENCHMARK_API_URL, payload, {
      timeout: 30_000,
    });
  } catch (apiError) {
    throw new CustomError(`Benchmark service error: ${(apiError as Error).message}`, 502);
  }

  const averageRatingByVendor = calculateAverageRatingPerVendor(apiResponse.data);
  await Promise.all(
    Object.entries(averageRatingByVendor).map(([vendorId, rating]) =>
      contractRepo.updateContractByRequisitionAndVendor(
        requisitionId,
        Number(vendorId),
        { rating }
      )
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
        status: 'Benchmarked',
      };

  if (Object.keys(updateData).length) {
    await requisitionRepo.updateRequisition(requisitionId, updateData);
  }

  const updatedRequisition = await requisitionRepo.getRequisition({ id: requisitionId });

  return {
    benchmarkedAt: updatedRequisition?.benchmarkedAt,
    benchmarkedBy: updatedRequisition?.benchmarkedBy,
    status: updatedRequisition?.status,
    benchmarkResponse: updatedRequisition?.benchmarkResponse,
    finalBenchmarkResult,
  };
};
