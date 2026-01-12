import models from '../../models/index.js';
import type { Company } from '../../models/company.js';
import type { User } from '../../models/user.js';
import type { Transaction, FindOptions } from 'sequelize';

/**
 * Company repository for database operations
 * Provides type-safe CRUD operations for Company entity
 */
interface CompanyQueryOptions extends FindOptions<Company> {
  where?: Record<string, unknown>;
  limit?: number;
  offset?: number;
}

interface CompanyRepository {
  getCompanyByUser: (userId: number) => Promise<Company | null>;
  createCompany: (companyData: Partial<Company>, transaction?: Transaction | null) => Promise<Company>;
  getAllCompanies: (queryOptions: CompanyQueryOptions) => Promise<{ rows: Company[]; count: number }>;
  getCompany: (companyId: number) => Promise<Company | null>;
  updateCompany: (companyId: number, companyData: Partial<Company>, transaction?: Transaction | null) => Promise<[affectedCount: number]>;
  deleteCompany: (companyId: number) => Promise<number>;
}

const repo: CompanyRepository = {
  getCompanyByUser: async (userId: number): Promise<Company | null> => {
    return models.Company.findOne({ where: { userId } as any });
  },

  createCompany: async (companyData: Partial<Company> = {}, transaction: Transaction | null = null): Promise<Company> => {
    return models.Company.create(companyData, { transaction });
  },

  getAllCompanies: async (queryOptions: CompanyQueryOptions): Promise<{ rows: Company[]; count: number }> => {
    return models.Company.findAndCountAll(queryOptions);
  },

  getCompany: async (companyId: number): Promise<Company | null> => {
    return models.Company.findByPk(companyId, {
      include: {
        model: models.User,
        as: 'Users',
      },
    });
  },

  updateCompany: async (
    companyId: number,
    companyData: Partial<Company>,
    transaction: Transaction | null = null
  ): Promise<[affectedCount: number]> => {
    return models.Company.update(companyData, { where: { id: companyId }, transaction });
  },

  deleteCompany: async (companyId: number): Promise<number> => {
    return models.Company.destroy({ where: { id: companyId } });
  },
};

export default repo;
