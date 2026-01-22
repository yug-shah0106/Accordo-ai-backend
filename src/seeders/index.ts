/**
 * Database Seeders
 * Auto-seed essential data (uses findOrCreate, safe to run multiple times)
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  Module,
  Role,
  RolePermission,
  Company,
  User,
  Product,
  Project,
  Requisition,
  RequisitionProduct,
  Contract,
  ChatbotDeal,
  Address,
  VendorCompany,
} from '../models/index.js';
import logger from '../config/logger.js';
import { sendVendorAttachedEmail } from '../services/email.service.js';
import env from '../config/env.js';

/**
 * Seed modules
 */
async function seedModules(): Promise<void> {
  try {
    const modules = [
      { id: 1, name: 'Dashboard', isArchived: false },
      { id: 2, name: 'User Management', isArchived: false },
      { id: 3, name: 'Projects', isArchived: false },
      { id: 4, name: 'Requisitions', isArchived: false },
      { id: 5, name: 'Vendors', isArchived: false },
      { id: 6, name: 'Approvals', isArchived: false },
    ];

    for (const moduleData of modules) {
      await Module.findOrCreate({
        where: { id: moduleData.id },
        defaults: moduleData,
      });
    }

    logger.info('Modules seeded successfully');
  } catch (error) {
    logger.error('Error seeding modules:', error);
    throw error;
  }
}

/**
 * Seed companies
 */
async function seedCompanies(): Promise<void> {
  try {
    const companies = [
      {
        id: 1,
        companyName: 'Accordo Technologies',
        nature: 'Domestic' as const,
        type: 'Enterprise',
        numberOfEmployees: '100-1000' as const,
        industryType: 'Industry1' as const,
        typeOfCurrency: 'USD' as const,
        pocName: 'John Admin',
        pocEmail: 'admin@accordo.ai',
        pocPhone: '+1-555-0100',
        fullAddress: '123 Tech Park, Silicon Valley, CA 94000',
      },
      {
        id: 2,
        companyName: 'TechSupply Corp',
        nature: 'Domestic' as const,
        type: 'Vendor',
        numberOfEmployees: '10-100' as const,
        industryType: 'Industry1' as const,
        typeOfCurrency: 'USD' as const,
        pocName: 'Sarah Vendor',
        pocEmail: 'contact@techsupply.com',
        pocPhone: '+1-555-0201',
        fullAddress: '456 Industrial Blvd, Austin, TX 78701',
      },
      {
        id: 3,
        companyName: 'GlobalParts Inc',
        nature: 'Interational' as const,
        type: 'Vendor',
        numberOfEmployees: '1000+' as const,
        industryType: 'Industry2' as const,
        typeOfCurrency: 'EUR' as const,
        pocName: 'Mike Global',
        pocEmail: 'sales@globalparts.eu',
        pocPhone: '+44-20-5550300',
        fullAddress: '789 Commerce St, London, UK EC1A 1BB',
      },
      // === NEW VENDOR COMPANIES FOR WIZARD TESTING ===
      {
        id: 4,
        companyName: 'ServerDirect USA',
        nature: 'Domestic' as const,
        type: 'Vendor',
        numberOfEmployees: '100-1000' as const,
        industryType: 'Industry1' as const,
        typeOfCurrency: 'USD' as const,
        pocName: 'Tom Server',
        pocEmail: 'orders@serverdirect.us',
        pocPhone: '+1-555-0401',
        fullAddress: '100 Data Center Way, Dallas, TX 75201',
      },
      {
        id: 5,
        companyName: 'OfficeMax Pro',
        nature: 'Domestic' as const,
        type: 'Vendor',
        numberOfEmployees: '10-100' as const,
        industryType: 'Industry2' as const,
        typeOfCurrency: 'USD' as const,
        pocName: 'Lisa Office',
        pocEmail: 'b2b@officemaxpro.com',
        pocPhone: '+1-555-0501',
        fullAddress: '250 Supply Chain Dr, Chicago, IL 60601',
      },
      {
        id: 6,
        companyName: 'MetalWorks Global',
        nature: 'Interational' as const,
        type: 'Vendor',
        numberOfEmployees: '1000+' as const,
        industryType: 'Industry2' as const,
        typeOfCurrency: 'USD' as const,
        pocName: 'Hans Metal',
        pocEmail: 'sales@metalworksglobal.com',
        pocPhone: '+49-30-5550600',
        fullAddress: '500 Industrial Park, Hamburg, Germany 20095',
      },
      {
        id: 7,
        companyName: 'SoftwareDirect',
        nature: 'Domestic' as const,
        type: 'Vendor',
        numberOfEmployees: '10-100' as const,
        industryType: 'Industry1' as const,
        typeOfCurrency: 'USD' as const,
        pocName: 'Emily Software',
        pocEmail: 'licensing@softwaredirect.com',
        pocPhone: '+1-555-0701',
        fullAddress: '789 License Blvd, Seattle, WA 98101',
      },
    ];

    for (const companyData of companies) {
      await Company.findOrCreate({
        where: { id: companyData.id },
        defaults: companyData,
      });
    }

    logger.info('Companies seeded successfully');
  } catch (error) {
    logger.error('Error seeding companies:', error);
    throw error;
  }
}

/**
 * Seed default roles
 */
async function seedRoles(): Promise<void> {
  try {
    const roles = [
      { id: 1, name: 'Super Admin', companyId: 1, isArchived: false },
      { id: 2, name: 'Procurement Manager', companyId: 1, isArchived: false },
      { id: 3, name: 'Procurement Manager Approver', companyId: 1, isArchived: false },
      { id: 4, name: 'HOD Approver', companyId: 1, isArchived: false },
      { id: 5, name: 'CFO Approver', companyId: 1, isArchived: false },
      { id: 6, name: 'Vendor User', companyId: null, isArchived: false },
    ];

    for (const roleData of roles) {
      await Role.findOrCreate({
        where: { id: roleData.id },
        defaults: roleData,
      });
    }

    logger.info('Roles seeded successfully');
  } catch (error) {
    logger.error('Error seeding roles:', error);
    throw error;
  }
}

/**
 * Seed role permissions
 */
async function seedRolePermissions(): Promise<void> {
  try {
    // Super Admin gets full access to all modules
    const superAdminPermissions = [
      { roleId: 1, moduleId: 1, permission: 15 }, // Dashboard - full
      { roleId: 1, moduleId: 2, permission: 15 }, // User Management - full
      { roleId: 1, moduleId: 3, permission: 15 }, // Projects - full
      { roleId: 1, moduleId: 4, permission: 15 }, // Requisitions - full
      { roleId: 1, moduleId: 5, permission: 15 }, // Vendors - full
      { roleId: 1, moduleId: 6, permission: 15 }, // Approvals - full
    ];

    // Procurement Manager - access to projects, requisitions, vendors
    const procurementPermissions = [
      { roleId: 2, moduleId: 1, permission: 1 },  // Dashboard - read
      { roleId: 2, moduleId: 3, permission: 15 }, // Projects - full
      { roleId: 2, moduleId: 4, permission: 15 }, // Requisitions - full
      { roleId: 2, moduleId: 5, permission: 7 },  // Vendors - read/write/update
    ];

    // Procurement Manager Approver (L1) - can view and approve requisitions up to $50,000
    const l1ApproverPermissions = [
      { roleId: 3, moduleId: 1, permission: 1 },  // Dashboard - read
      { roleId: 3, moduleId: 4, permission: 3 },  // Requisitions - read/write
      { roleId: 3, moduleId: 6, permission: 7 },  // Approvals - read/write/update
    ];

    // HOD Approver (L2) - can view and approve requisitions up to $250,000
    const l2ApproverPermissions = [
      { roleId: 4, moduleId: 1, permission: 1 },  // Dashboard - read
      { roleId: 4, moduleId: 4, permission: 3 },  // Requisitions - read/write
      { roleId: 4, moduleId: 6, permission: 7 },  // Approvals - read/write/update
    ];

    // CFO Approver (L3) - can view and approve all requisitions
    const l3ApproverPermissions = [
      { roleId: 5, moduleId: 1, permission: 1 },  // Dashboard - read
      { roleId: 5, moduleId: 4, permission: 3 },  // Requisitions - read/write
      { roleId: 5, moduleId: 6, permission: 15 }, // Approvals - full
    ];

    // Vendor User - limited access
    const vendorPermissions = [
      { roleId: 6, moduleId: 1, permission: 1 },  // Dashboard - read
      { roleId: 6, moduleId: 4, permission: 1 },  // Requisitions - read
    ];

    const allPermissions = [
      ...superAdminPermissions,
      ...procurementPermissions,
      ...l1ApproverPermissions,
      ...l2ApproverPermissions,
      ...l3ApproverPermissions,
      ...vendorPermissions,
    ];

    for (const permData of allPermissions) {
      await RolePermission.findOrCreate({
        where: { roleId: permData.roleId, moduleId: permData.moduleId },
        defaults: permData,
      });
    }

    logger.info('Role permissions seeded successfully');
  } catch (error) {
    logger.error('Error seeding role permissions:', error);
    throw error;
  }
}

/**
 * Seed test users including L1, L2, L3 approvers
 */
async function seedUsers(): Promise<void> {
  try {
    // Hash the default password once
    const defaultPassword = await bcrypt.hash('password123', 10);

    const users = [
      // Admin User
      {
        id: 1,
        name: 'System Admin',
        email: 'admin@accordo.ai',
        password: defaultPassword,
        userType: 'admin' as const,
        companyId: 1,
        roleId: 1,
        status: 'active',
        approvalLevel: 'NONE' as const,
        approvalLimit: null,
      },
      // Procurement Manager
      {
        id: 2,
        name: 'Jane Procurement',
        email: 'jane.procurement@accordo.ai',
        password: defaultPassword,
        userType: 'customer' as const,
        companyId: 1,
        roleId: 2,
        status: 'active',
        approvalLevel: 'NONE' as const,
        approvalLimit: null,
      },
      // Procurement Manager Approver (L1) - can approve up to $50,000
      {
        id: 3,
        name: 'Tom - Procurement Manager',
        email: 'l1.approver@accordo.ai',
        password: defaultPassword,
        userType: 'customer' as const,
        companyId: 1,
        roleId: 3,
        status: 'active',
        approvalLevel: 'L1' as const,
        approvalLimit: 50000,
      },
      // HOD Approver (L2) - can approve up to $250,000
      {
        id: 4,
        name: 'Sarah - HOD',
        email: 'l2.approver@accordo.ai',
        password: defaultPassword,
        userType: 'customer' as const,
        companyId: 1,
        roleId: 4,
        status: 'active',
        approvalLevel: 'L2' as const,
        approvalLimit: 250000,
      },
      // CFO Approver (L3) - can approve any amount
      {
        id: 5,
        name: 'Michael - CFO',
        email: 'l3.approver@accordo.ai',
        password: defaultPassword,
        userType: 'customer' as const,
        companyId: 1,
        roleId: 5,
        status: 'active',
        approvalLevel: 'L3' as const,
        approvalLimit: 10000000, // 10 million
      },
      // Vendor Users
      {
        id: 6,
        name: 'TechSupply Sales Rep',
        email: 'sales@techsupply.com',
        password: defaultPassword,
        userType: 'vendor' as const,
        companyId: 2,
        roleId: 6,
        status: 'active',
        approvalLevel: 'NONE' as const,
        approvalLimit: null,
      },
      {
        id: 7,
        name: 'GlobalParts Account Manager',
        email: 'accounts@globalparts.eu',
        password: defaultPassword,
        userType: 'vendor' as const,
        companyId: 3,
        roleId: 6,
        status: 'active',
        approvalLevel: 'NONE' as const,
        approvalLimit: null,
      },
      // Additional Procurement Manager Approver for testing reassignment
      {
        id: 8,
        name: 'Lisa - Procurement Manager',
        email: 'l1.approver2@accordo.ai',
        password: defaultPassword,
        userType: 'customer' as const,
        companyId: 1,
        roleId: 3,
        status: 'active',
        approvalLevel: 'L1' as const,
        approvalLimit: 50000,
      },
      // === NEW VENDOR USERS FOR WIZARD TESTING ===
      {
        id: 9,
        name: 'ServerDirect Sales',
        email: 'sales@serverdirect.us',
        password: defaultPassword,
        userType: 'vendor' as const,
        companyId: 4,
        roleId: 6,
        status: 'active',
        approvalLevel: 'NONE' as const,
        approvalLimit: null,
      },
      {
        id: 10,
        name: 'OfficeMax Pro Sales',
        email: 'sales@officemaxpro.com',
        password: defaultPassword,
        userType: 'vendor' as const,
        companyId: 5,
        roleId: 6,
        status: 'active',
        approvalLevel: 'NONE' as const,
        approvalLimit: null,
      },
      {
        id: 11,
        name: 'MetalWorks Sales',
        email: 'sales@metalworksglobal.com',
        password: defaultPassword,
        userType: 'vendor' as const,
        companyId: 6,
        roleId: 6,
        status: 'active',
        approvalLevel: 'NONE' as const,
        approvalLimit: null,
      },
      {
        id: 12,
        name: 'SoftwareDirect Licensing',
        email: 'sales@softwaredirect.com',
        password: defaultPassword,
        userType: 'vendor' as const,
        companyId: 7,
        roleId: 6,
        status: 'active',
        approvalLevel: 'NONE' as const,
        approvalLimit: null,
      },
    ];

    for (const userData of users) {
      await User.findOrCreate({
        where: { id: userData.id },
        defaults: userData,
      });
    }

    logger.info('Users seeded successfully (including L1, L2, L3 approvers)');
  } catch (error) {
    logger.error('Error seeding users:', error);
    throw error;
  }
}

/**
 * Seed vendor addresses (1-3 addresses per vendor company)
 */
async function seedAddresses(): Promise<void> {
  try {
    const addresses = [
      // TechSupply Corp (Company ID 2) - 3 addresses
      {
        id: 1,
        companyId: 2,
        label: 'Headquarters',
        address: '456 Industrial Blvd, Suite 100',
        city: 'Austin',
        state: 'Texas',
        country: 'USA',
        postalCode: '78701',
        isDefault: true,
      },
      {
        id: 2,
        companyId: 2,
        label: 'Distribution Center',
        address: '1200 Logistics Way',
        city: 'Houston',
        state: 'Texas',
        country: 'USA',
        postalCode: '77001',
        isDefault: false,
      },
      {
        id: 3,
        companyId: 2,
        label: 'West Coast Warehouse',
        address: '800 Pacific Commerce Dr',
        city: 'Los Angeles',
        state: 'California',
        country: 'USA',
        postalCode: '90012',
        isDefault: false,
      },

      // GlobalParts Inc (Company ID 3) - 2 addresses
      {
        id: 4,
        companyId: 3,
        label: 'London HQ',
        address: '789 Commerce St, Tower A',
        city: 'London',
        state: 'England',
        country: 'United Kingdom',
        postalCode: 'EC1A 1BB',
        isDefault: true,
      },
      {
        id: 5,
        companyId: 3,
        label: 'European Distribution',
        address: '45 Rotterdam Port Rd',
        city: 'Rotterdam',
        state: 'South Holland',
        country: 'Netherlands',
        postalCode: '3011 AA',
        isDefault: false,
      },

      // ServerDirect USA (Company ID 4) - 2 addresses
      {
        id: 6,
        companyId: 4,
        label: 'Main Office',
        address: '100 Data Center Way',
        city: 'Dallas',
        state: 'Texas',
        country: 'USA',
        postalCode: '75201',
        isDefault: true,
      },
      {
        id: 7,
        companyId: 4,
        label: 'Tech Hub',
        address: '555 Server Lane, Building B',
        city: 'Phoenix',
        state: 'Arizona',
        country: 'USA',
        postalCode: '85001',
        isDefault: false,
      },

      // OfficeMax Pro (Company ID 5) - 3 addresses
      {
        id: 8,
        companyId: 5,
        label: 'Corporate Office',
        address: '250 Supply Chain Dr',
        city: 'Chicago',
        state: 'Illinois',
        country: 'USA',
        postalCode: '60601',
        isDefault: true,
      },
      {
        id: 9,
        companyId: 5,
        label: 'Midwest Warehouse',
        address: '1500 Distribution Pkwy',
        city: 'Indianapolis',
        state: 'Indiana',
        country: 'USA',
        postalCode: '46201',
        isDefault: false,
      },
      {
        id: 10,
        companyId: 5,
        label: 'East Coast Fulfillment',
        address: '300 Commerce Center Blvd',
        city: 'Newark',
        state: 'New Jersey',
        country: 'USA',
        postalCode: '07102',
        isDefault: false,
      },

      // MetalWorks Global (Company ID 6) - 2 addresses
      {
        id: 11,
        companyId: 6,
        label: 'Hamburg Headquarters',
        address: '500 Industrial Park, Haus 1',
        city: 'Hamburg',
        state: 'Hamburg',
        country: 'Germany',
        postalCode: '20095',
        isDefault: true,
      },
      {
        id: 12,
        companyId: 6,
        label: 'Steel Processing Plant',
        address: '220 Metallweg',
        city: 'Duisburg',
        state: 'North Rhine-Westphalia',
        country: 'Germany',
        postalCode: '47051',
        isDefault: false,
      },

      // SoftwareDirect (Company ID 7) - 1 address
      {
        id: 13,
        companyId: 7,
        label: 'Seattle Office',
        address: '789 License Blvd, Floor 12',
        city: 'Seattle',
        state: 'Washington',
        country: 'USA',
        postalCode: '98101',
        isDefault: true,
      },
    ];

    for (const addressData of addresses) {
      await Address.findOrCreate({
        where: { id: addressData.id },
        defaults: addressData,
      });
    }

    logger.info('Vendor addresses seeded successfully (13 addresses for 6 vendors)');
  } catch (error) {
    logger.error('Error seeding addresses:', error);
    throw error;
  }
}

/**
 * Seed vendor-company associations
 * Links vendor users to the customer company (Accordo Technologies) so they appear in vendor dropdowns
 */
async function seedVendorCompanies(): Promise<void> {
  try {
    // All vendor user IDs from seedUsers (users with userType='vendor')
    // Linking them to company ID 1 (Accordo Technologies) makes them available
    // in the vendor dropdown when a user from company 1 is logged in
    const vendorCompanyAssociations = [
      { id: 1, vendorId: 6, companyId: 1 },  // TechSupply Sales Rep
      { id: 2, vendorId: 7, companyId: 1 },  // GlobalParts Account Manager
      { id: 3, vendorId: 9, companyId: 1 },  // ServerDirect Sales
      { id: 4, vendorId: 10, companyId: 1 }, // OfficeMax Pro Sales
      { id: 5, vendorId: 11, companyId: 1 }, // MetalWorks Sales
      { id: 6, vendorId: 12, companyId: 1 }, // SoftwareDirect Licensing
    ];

    for (const vcData of vendorCompanyAssociations) {
      await VendorCompany.findOrCreate({
        where: { id: vcData.id },
        defaults: vcData,
      });
    }

    logger.info('Vendor-company associations seeded successfully (6 vendors linked to Accordo Technologies)');
  } catch (error) {
    logger.error('Error seeding vendor-company associations:', error);
    throw error;
  }
}

/**
 * Seed sample products
 */
async function seedProducts(): Promise<void> {
  try {
    const products = [
      {
        id: 1,
        productName: 'Enterprise Laptop - Dell XPS 15',
        category: 'Electronics',
        brandName: 'Dell',
        gstType: 'GST' as const,
        gstPercentage: 18,
        UOM: 'unit',
        companyId: 1,
      },
      {
        id: 2,
        productName: 'Office Chair - Ergonomic Pro',
        category: 'Furniture',
        brandName: 'Herman Miller',
        gstType: 'GST' as const,
        gstPercentage: 12,
        UOM: 'unit',
        companyId: 1,
      },
      {
        id: 3,
        productName: 'Network Switch - 48 Port',
        category: 'Networking',
        brandName: 'Cisco',
        gstType: 'GST' as const,
        gstPercentage: 18,
        UOM: 'unit',
        companyId: 1,
      },
      {
        id: 4,
        productName: 'Server Rack - 42U',
        category: 'Infrastructure',
        brandName: 'APC',
        gstType: 'GST' as const,
        gstPercentage: 18,
        UOM: 'unit',
        companyId: 1,
      },
      {
        id: 5,
        productName: 'Software License - Office 365',
        category: 'Software',
        brandName: 'Microsoft',
        gstType: 'GST' as const,
        gstPercentage: 18,
        UOM: 'license',
        companyId: 1,
      },
      // === NEW PRODUCTS FOR WIZARD TESTING ===
      {
        id: 6,
        productName: 'Dell PowerEdge R750 Server',
        category: 'IT Hardware',
        brandName: 'Dell',
        gstType: 'GST' as const,
        gstPercentage: 18,
        UOM: 'unit',
        companyId: 1,
      },
      {
        id: 7,
        productName: 'Cisco Catalyst 9300 Switch',
        category: 'IT Hardware',
        brandName: 'Cisco',
        gstType: 'GST' as const,
        gstPercentage: 18,
        UOM: 'unit',
        companyId: 1,
      },
      {
        id: 8,
        productName: 'NetApp AFF A250 Storage',
        category: 'IT Hardware',
        brandName: 'NetApp',
        gstType: 'GST' as const,
        gstPercentage: 18,
        UOM: 'unit',
        companyId: 1,
      },
      {
        id: 9,
        productName: 'A4 Paper (Box 5000)',
        category: 'Office Supplies',
        brandName: 'HP',
        gstType: 'GST' as const,
        gstPercentage: 5,
        UOM: 'box',
        companyId: 1,
      },
      {
        id: 10,
        productName: 'Printer Toner Multi-pack',
        category: 'Office Supplies',
        brandName: 'HP',
        gstType: 'GST' as const,
        gstPercentage: 18,
        UOM: 'pack',
        companyId: 1,
      },
      {
        id: 11,
        productName: 'Steel Coil Grade A',
        category: 'Raw Materials',
        brandName: 'ArcelorMittal',
        gstType: 'GST' as const,
        gstPercentage: 18,
        UOM: 'ton',
        companyId: 1,
      },
      {
        id: 12,
        productName: 'Aluminum Sheet 6061',
        category: 'Raw Materials',
        brandName: 'Alcoa',
        gstType: 'GST' as const,
        gstPercentage: 18,
        UOM: 'sheet',
        companyId: 1,
      },
      {
        id: 13,
        productName: 'Copper Wire AWG 10',
        category: 'Raw Materials',
        brandName: 'Southwire',
        gstType: 'GST' as const,
        gstPercentage: 18,
        UOM: 'roll',
        companyId: 1,
      },
      {
        id: 14,
        productName: 'Microsoft 365 E5 License',
        category: 'Software',
        brandName: 'Microsoft',
        gstType: 'GST' as const,
        gstPercentage: 18,
        UOM: 'license',
        companyId: 1,
      },
      {
        id: 15,
        productName: 'Adobe Creative Cloud Team',
        category: 'Software',
        brandName: 'Adobe',
        gstType: 'GST' as const,
        gstPercentage: 18,
        UOM: 'license',
        companyId: 1,
      },
    ];

    for (const productData of products) {
      await Product.findOrCreate({
        where: { id: productData.id },
        defaults: productData,
      });
    }

    logger.info('Products seeded successfully');
  } catch (error) {
    logger.error('Error seeding products:', error);
    throw error;
  }
}

/**
 * Seed sample projects
 */
async function seedProjects(): Promise<void> {
  try {
    const projects = [
      {
        id: 1,
        projectId: 'PRO0001',
        projectName: 'IT Infrastructure Upgrade',
        projectAddress: 'HQ - Silicon Valley',
        typeOfProject: 'Infrastructure',
        tenureInDays: 180,
        companyId: 1,
      },
      {
        id: 2,
        projectId: 'PRO0002',
        projectName: 'Office Expansion - Building B',
        projectAddress: 'Building B - Austin Campus',
        typeOfProject: 'Expansion',
        tenureInDays: 365,
        companyId: 1,
      },
      {
        id: 3,
        projectId: 'PRO0003',
        projectName: 'Software License Renewal',
        projectAddress: 'Corporate - All Locations',
        typeOfProject: 'Procurement',
        tenureInDays: 30,
        companyId: 1,
      },
    ];

    for (const projectData of projects) {
      await Project.findOrCreate({
        where: { id: projectData.id },
        defaults: projectData,
      });
    }

    logger.info('Projects seeded successfully');
  } catch (error) {
    logger.error('Error seeding projects:', error);
    throw error;
  }
}

/**
 * Seed sample requisitions
 */
async function seedRequisitions(): Promise<void> {
  try {
    const requisitions = [
      {
        id: 1,
        projectId: 1,
        rfqId: 'RFQ0001',
        subject: 'IT Equipment Procurement - Q1 2026',
        category: 'IT Equipment',
        deliveryDate: new Date('2026-03-15'),
        negotiationClosureDate: new Date('2026-02-28'),
        typeOfCurrency: 'USD' as const,
        totalPrice: 75000,
        status: 'NegotiationStarted' as const,
        payment_terms: 'Net 30',
        net_payment_day: '30',
        pricePriority: 'high',
        deliveryPriority: 'medium',
        paymentTermsPriority: 'medium',
        batna: 70000,
        maxDiscount: 10,
        createdBy: 2, // Jane Procurement
        approvalStatus: 'FULLY_APPROVED' as const,
        totalEstimatedAmount: 75000,
        requiredApprovalLevel: 'L2' as const,
      },
      {
        id: 2,
        projectId: 2,
        rfqId: 'RFQ0002',
        subject: 'Office Furniture - Building B',
        category: 'Furniture',
        deliveryDate: new Date('2026-04-30'),
        negotiationClosureDate: new Date('2026-03-31'),
        typeOfCurrency: 'USD' as const,
        totalPrice: 45000,
        status: 'NegotiationStarted' as const,
        payment_terms: 'Net 45',
        net_payment_day: '45',
        pricePriority: 'medium',
        deliveryPriority: 'high',
        paymentTermsPriority: 'low',
        batna: 42000,
        maxDiscount: 15,
        createdBy: 2,
        approvalStatus: 'FULLY_APPROVED' as const,
        totalEstimatedAmount: 45000,
        requiredApprovalLevel: 'L1' as const,
      },
      {
        id: 3,
        projectId: 3,
        rfqId: 'RFQ0003',
        subject: 'Annual Software Licenses',
        category: 'Software',
        deliveryDate: new Date('2026-02-15'),
        negotiationClosureDate: new Date('2026-02-10'),
        typeOfCurrency: 'USD' as const,
        totalPrice: 15000,
        status: 'NegotiationStarted' as const,
        payment_terms: 'Net 30',
        net_payment_day: '30',
        pricePriority: 'low',
        deliveryPriority: 'high',
        paymentTermsPriority: 'medium',
        batna: 14000,
        maxDiscount: 5,
        createdBy: 2,
        approvalStatus: 'FULLY_APPROVED' as const,
        totalEstimatedAmount: 15000,
        requiredApprovalLevel: 'L1' as const,
      },
      // === NEW REQUISITIONS FOR WIZARD TESTING ===
      {
        id: 4,
        projectId: 1,
        rfqId: 'RFQ-TEST-001',
        subject: 'Enterprise Server Infrastructure Q1 2026',
        category: 'IT Hardware',
        deliveryDate: new Date('2026-03-01'),
        negotiationClosureDate: new Date('2026-02-15'),
        typeOfCurrency: 'USD' as const,
        totalPrice: 250000,
        status: 'Created' as const,
        payment_terms: 'Net 60',
        net_payment_day: '60',
        pricePriority: 'high',
        deliveryPriority: 'high',
        paymentTermsPriority: 'medium',
        batna: 225000,
        maxDiscount: 15,
        createdBy: 2,
        approvalStatus: 'FULLY_APPROVED' as const,
        totalEstimatedAmount: 250000,
        requiredApprovalLevel: 'L3' as const,
      },
      {
        id: 5,
        projectId: 2,
        rfqId: 'RFQ-TEST-002',
        subject: 'Office Supplies Bulk Order 2026',
        category: 'Office Supplies',
        deliveryDate: new Date('2026-02-28'),
        negotiationClosureDate: new Date('2026-01-31'),
        typeOfCurrency: 'USD' as const,
        totalPrice: 35000,
        status: 'Created' as const,
        payment_terms: 'Net 30',
        net_payment_day: '30',
        pricePriority: 'medium',
        deliveryPriority: 'low',
        paymentTermsPriority: 'high',
        batna: 32000,
        maxDiscount: 10,
        createdBy: 2,
        approvalStatus: 'FULLY_APPROVED' as const,
        totalEstimatedAmount: 35000,
        requiredApprovalLevel: 'L1' as const,
      },
      {
        id: 6,
        projectId: 1,
        rfqId: 'RFQ-TEST-003',
        subject: 'Steel & Aluminum Raw Materials Q1',
        category: 'Raw Materials',
        deliveryDate: new Date('2026-04-01'),
        negotiationClosureDate: new Date('2026-03-01'),
        typeOfCurrency: 'USD' as const,
        totalPrice: 500000,
        status: 'Created' as const,
        payment_terms: 'Net 45',
        net_payment_day: '45',
        pricePriority: 'high',
        deliveryPriority: 'medium',
        paymentTermsPriority: 'medium',
        batna: 475000,
        maxDiscount: 8,
        createdBy: 2,
        approvalStatus: 'FULLY_APPROVED' as const,
        totalEstimatedAmount: 500000,
        requiredApprovalLevel: 'L3' as const,
      },
      {
        id: 7,
        projectId: 3,
        rfqId: 'RFQ-TEST-004',
        subject: 'Enterprise Software License Renewal',
        category: 'Software',
        deliveryDate: new Date('2026-03-15'),
        negotiationClosureDate: new Date('2026-02-28'),
        typeOfCurrency: 'USD' as const,
        totalPrice: 75000,
        status: 'Created' as const,
        payment_terms: 'Net 30',
        net_payment_day: '30',
        pricePriority: 'low',
        deliveryPriority: 'high',
        paymentTermsPriority: 'medium',
        batna: 70000,
        maxDiscount: 12,
        createdBy: 2,
        approvalStatus: 'FULLY_APPROVED' as const,
        totalEstimatedAmount: 75000,
        requiredApprovalLevel: 'L2' as const,
      },
    ];

    for (const reqData of requisitions) {
      await Requisition.findOrCreate({
        where: { id: reqData.id },
        defaults: reqData,
      });
    }

    logger.info('Requisitions seeded successfully');
  } catch (error) {
    logger.error('Error seeding requisitions:', error);
    throw error;
  }
}

/**
 * Seed requisition products (line items)
 */
async function seedRequisitionProducts(): Promise<void> {
  try {
    const requisitionProducts = [
      // Requisition 1: IT Equipment
      { id: 1, requisitionId: 1, productId: 1, targetPrice: 1400, maximum_price: 1600, qty: 30, createdBy: 2 }, // Laptops
      { id: 2, requisitionId: 1, productId: 3, targetPrice: 2200, maximum_price: 2600, qty: 5, createdBy: 2 },  // Network switches
      { id: 3, requisitionId: 1, productId: 4, targetPrice: 3200, maximum_price: 3800, qty: 2, createdBy: 2 },  // Server racks

      // Requisition 2: Office Furniture
      { id: 4, requisitionId: 2, productId: 2, targetPrice: 400, maximum_price: 500, qty: 100, createdBy: 2 },  // Office chairs

      // Requisition 3: Software Licenses
      { id: 5, requisitionId: 3, productId: 5, targetPrice: 140, maximum_price: 160, qty: 100, createdBy: 2 },  // Office 365

      // === NEW REQUISITION PRODUCTS FOR WIZARD TESTING ===

      // Requisition 4: Enterprise Server Infrastructure (RFQ-TEST-001)
      { id: 6, requisitionId: 4, productId: 6, targetPrice: 12000, maximum_price: 14000, qty: 10, createdBy: 2 },  // Dell PowerEdge R750
      { id: 7, requisitionId: 4, productId: 7, targetPrice: 8500, maximum_price: 10000, qty: 5, createdBy: 2 },   // Cisco Catalyst 9300
      { id: 8, requisitionId: 4, productId: 8, targetPrice: 45000, maximum_price: 52000, qty: 2, createdBy: 2 },  // NetApp AFF A250

      // Requisition 5: Office Supplies Bulk Order (RFQ-TEST-002)
      { id: 9, requisitionId: 5, productId: 9, targetPrice: 45, maximum_price: 55, qty: 200, createdBy: 2 },     // A4 Paper
      { id: 10, requisitionId: 5, productId: 10, targetPrice: 180, maximum_price: 220, qty: 50, createdBy: 2 },  // Toner
      { id: 11, requisitionId: 5, productId: 2, targetPrice: 350, maximum_price: 420, qty: 30, createdBy: 2 },   // Ergonomic chairs

      // Requisition 6: Steel & Aluminum Raw Materials (RFQ-TEST-003)
      { id: 12, requisitionId: 6, productId: 11, targetPrice: 2500, maximum_price: 2900, qty: 100, createdBy: 2 }, // Steel Coil
      { id: 13, requisitionId: 6, productId: 12, targetPrice: 450, maximum_price: 530, qty: 500, createdBy: 2 },   // Aluminum Sheet
      { id: 14, requisitionId: 6, productId: 13, targetPrice: 85, maximum_price: 100, qty: 1000, createdBy: 2 },   // Copper Wire

      // Requisition 7: Enterprise Software License Renewal (RFQ-TEST-004)
      { id: 15, requisitionId: 7, productId: 14, targetPrice: 350, maximum_price: 400, qty: 100, createdBy: 2 },  // Microsoft 365 E5
      { id: 16, requisitionId: 7, productId: 15, targetPrice: 800, maximum_price: 900, qty: 25, createdBy: 2 },   // Adobe Creative Cloud
    ];

    for (const rpData of requisitionProducts) {
      await RequisitionProduct.findOrCreate({
        where: { id: rpData.id },
        defaults: rpData,
      });
    }

    logger.info('Requisition products seeded successfully');
  } catch (error) {
    logger.error('Error seeding requisition products:', error);
    throw error;
  }
}

/**
 * Seed contracts with vendor attachments and chatbot deals
 * This will also send emails to vendors (if email service is configured)
 */
async function seedContractsAndDeals(sendEmails: boolean = false): Promise<void> {
  try {
    // Generate unique tokens for contracts
    const generateToken = () => crypto.randomBytes(16).toString('hex');

    // Define contracts with their chatbot deals
    const contractsData = [
      {
        contract: {
          id: 1,
          companyId: 1,
          requisitionId: 1,
          vendorId: 6, // TechSupply Sales Rep
          status: 'Created' as const,
          uniqueToken: generateToken(),
          createdBy: 2,
        },
        deal: {
          id: uuidv4(),
          title: 'IT Infrastructure Upgrade - IT Equipment Procurement - Q1 2026',
          counterparty: 'TechSupply Corp',
          status: 'NEGOTIATING' as const,
          mode: 'CONVERSATION' as const,
          round: 0,
          requisitionId: 1,
          vendorId: 6,
          userId: 2,
        },
      },
      {
        contract: {
          id: 2,
          companyId: 1,
          requisitionId: 1,
          vendorId: 7, // GlobalParts Account Manager
          status: 'Created' as const,
          uniqueToken: generateToken(),
          createdBy: 2,
        },
        deal: {
          id: uuidv4(),
          title: 'IT Infrastructure Upgrade - IT Equipment Procurement - Q1 2026',
          counterparty: 'GlobalParts Inc',
          status: 'NEGOTIATING' as const,
          mode: 'CONVERSATION' as const,
          round: 0,
          requisitionId: 1,
          vendorId: 7,
          userId: 2,
        },
      },
      {
        contract: {
          id: 3,
          companyId: 1,
          requisitionId: 2,
          vendorId: 6, // TechSupply for furniture
          status: 'Created' as const,
          uniqueToken: generateToken(),
          createdBy: 2,
        },
        deal: {
          id: uuidv4(),
          title: 'Office Expansion - Building B - Office Furniture - Building B',
          counterparty: 'TechSupply Corp',
          status: 'NEGOTIATING' as const,
          mode: 'CONVERSATION' as const,
          round: 0,
          requisitionId: 2,
          vendorId: 6,
          userId: 2,
        },
      },
      {
        contract: {
          id: 4,
          companyId: 1,
          requisitionId: 3,
          vendorId: 7, // GlobalParts for software
          status: 'Created' as const,
          uniqueToken: generateToken(),
          createdBy: 2,
        },
        deal: {
          id: uuidv4(),
          title: 'Software License Renewal - Annual Software Licenses',
          counterparty: 'GlobalParts Inc',
          status: 'NEGOTIATING' as const,
          mode: 'CONVERSATION' as const,
          round: 0,
          requisitionId: 3,
          vendorId: 7,
          userId: 2,
        },
      },
      // === NEW CONTRACTS FOR WIZARD TESTING (RFQ-TEST-001 to RFQ-TEST-004) ===
      // RFQ-TEST-001: Enterprise Server Infrastructure - Multiple vendors
      {
        contract: {
          id: 5,
          companyId: 1,
          requisitionId: 4,
          vendorId: 6, // TechSupply
          status: 'Created' as const,
          uniqueToken: generateToken(),
          createdBy: 2,
        },
        deal: null, // No deal yet - for wizard testing
      },
      {
        contract: {
          id: 6,
          companyId: 1,
          requisitionId: 4,
          vendorId: 7, // GlobalParts
          status: 'Created' as const,
          uniqueToken: generateToken(),
          createdBy: 2,
        },
        deal: null,
      },
      {
        contract: {
          id: 7,
          companyId: 1,
          requisitionId: 4,
          vendorId: 9, // ServerDirect
          status: 'Created' as const,
          uniqueToken: generateToken(),
          createdBy: 2,
        },
        deal: null,
      },
      // RFQ-TEST-002: Office Supplies - Two vendors
      {
        contract: {
          id: 8,
          companyId: 1,
          requisitionId: 5,
          vendorId: 10, // OfficeMax Pro
          status: 'Created' as const,
          uniqueToken: generateToken(),
          createdBy: 2,
        },
        deal: null,
      },
      {
        contract: {
          id: 9,
          companyId: 1,
          requisitionId: 5,
          vendorId: 6, // TechSupply
          status: 'Created' as const,
          uniqueToken: generateToken(),
          createdBy: 2,
        },
        deal: null,
      },
      // RFQ-TEST-003: Steel & Aluminum - Multiple vendors
      {
        contract: {
          id: 10,
          companyId: 1,
          requisitionId: 6,
          vendorId: 11, // MetalWorks Global
          status: 'Created' as const,
          uniqueToken: generateToken(),
          createdBy: 2,
        },
        deal: null,
      },
      {
        contract: {
          id: 11,
          companyId: 1,
          requisitionId: 6,
          vendorId: 7, // GlobalParts
          status: 'Created' as const,
          uniqueToken: generateToken(),
          createdBy: 2,
        },
        deal: null,
      },
      // RFQ-TEST-004: Software Licenses - Two vendors
      {
        contract: {
          id: 12,
          companyId: 1,
          requisitionId: 7,
          vendorId: 12, // SoftwareDirect
          status: 'Created' as const,
          uniqueToken: generateToken(),
          createdBy: 2,
        },
        deal: null,
      },
      {
        contract: {
          id: 13,
          companyId: 1,
          requisitionId: 7,
          vendorId: 7, // GlobalParts
          status: 'Created' as const,
          uniqueToken: generateToken(),
          createdBy: 2,
        },
        deal: null,
      },
    ];

    for (const { contract, deal } of contractsData) {
      // Check if contract already exists
      const existingContract = await Contract.findByPk(contract.id);
      if (existingContract) {
        logger.info(`Contract ${contract.id} already exists, skipping...`);
        continue;
      }

      // Create the contract - with or without deal
      let chatbotDealId: string | null = null;

      // Only create deal if provided (some contracts are for wizard testing without deals)
      if (deal) {
        const [createdDeal] = await ChatbotDeal.findOrCreate({
          where: { id: deal.id },
          defaults: deal,
        });
        chatbotDealId = createdDeal.id;
      }

      // Create the contract with the deal ID (if any)
      const contractWithDeal = {
        ...contract,
        chatbotDealId,
      };

      const [createdContract] = await Contract.findOrCreate({
        where: { id: contract.id },
        defaults: contractWithDeal,
      });

      // Update the deal with the contract ID (if deal exists)
      if (deal && chatbotDealId) {
        await ChatbotDeal.update(
          { contractId: createdContract.id },
          { where: { id: chatbotDealId } }
        );
      }

      // Send email to vendor if enabled and deal exists
      if (sendEmails && chatbotDealId) {
        try {
          // Load the contract with vendor association
          const contractWithVendor = await Contract.findByPk(createdContract.id, {
            include: [
              { model: User, as: 'Vendor' },
            ],
          });

          // Load the requisition with project and products
          const requisition = await Requisition.findByPk(contract.requisitionId, {
            include: [
              { model: Project, as: 'Project' },
              {
                model: RequisitionProduct,
                as: 'RequisitionProduct',
                include: [{ model: Product, as: 'Product' }],
              },
            ],
          });

          if (contractWithVendor && requisition) {
            // Transform the requisition data for the email
            const reqWithProducts = {
              ...requisition.toJSON(),
              title: requisition.subject,
              Products: (requisition as any).RequisitionProduct?.map((rp: any) => ({
                name: rp.Product?.productName || 'Unknown Product',
                quantity: rp.qty || 0,
                targetPrice: rp.targetPrice || 0,
              })) || [],
            };

            await sendVendorAttachedEmail(
              contractWithVendor as any,
              reqWithProducts as any,
              chatbotDealId
            );
            logger.info(`Email sent to vendor for contract ${createdContract.id}`);
          }
        } catch (emailError) {
          logger.warn(`Failed to send email for contract ${createdContract.id}:`, emailError);
          // Don't throw - continue with other contracts
        }
      }
    }

    logger.info('Contracts and chatbot deals seeded successfully');
  } catch (error) {
    logger.error('Error seeding contracts and deals:', error);
    throw error;
  }
}

/**
 * Seed all essential data
 */
export async function seedAll(): Promise<void> {
  try {
    // Core system data
    await seedModules();
    await seedCompanies();
    await seedRoles();
    await seedRolePermissions();

    // Test data
    await seedUsers();
    await seedAddresses();
    await seedVendorCompanies(); // Link vendors to customer company
    await seedProducts();
    await seedProjects();

    // Requisitions and vendor attachments
    await seedRequisitions();
    await seedRequisitionProducts();

    // Check if we should send emails (controlled via env variable)
    const sendEmails = process.env.SEED_SEND_EMAILS === 'true';
    await seedContractsAndDeals(sendEmails);

    logger.info('All seeders completed successfully');
    logger.info('');
    logger.info('=== Test Users Created ===');
    logger.info('Admin:                    admin@accordo.ai / password123');
    logger.info('Procurement:              jane.procurement@accordo.ai / password123');
    logger.info('Procurement Manager (L1): l1.approver@accordo.ai / password123 (limit: $50,000)');
    logger.info('HOD (L2):                 l2.approver@accordo.ai / password123 (limit: $250,000)');
    logger.info('CFO (L3):                 l3.approver@accordo.ai / password123 (limit: $10,000,000)');
    logger.info('Vendor 1:        sales@techsupply.com / password123');
    logger.info('Vendor 2:        accounts@globalparts.eu / password123');
    logger.info('');
    logger.info('=== NEW Vendor Users for Wizard Testing ===');
    logger.info('Vendor 3:        sales@serverdirect.us / password123 (ServerDirect USA)');
    logger.info('Vendor 4:        sales@officemaxpro.com / password123 (OfficeMax Pro)');
    logger.info('Vendor 5:        sales@metalworksglobal.com / password123 (MetalWorks Global)');
    logger.info('Vendor 6:        sales@softwaredirect.com / password123 (SoftwareDirect)');
    logger.info('');
    logger.info('=== Requisitions Created ===');
    logger.info('RFQ0001: IT Equipment Procurement ($75,000) - 2 vendors attached');
    logger.info('RFQ0002: Office Furniture ($45,000) - 1 vendor attached');
    logger.info('RFQ0003: Annual Software Licenses ($15,000) - 1 vendor attached');
    logger.info('');
    logger.info('=== NEW Requisitions for Wizard Testing (No deals created - use wizard!) ===');
    logger.info('RFQ-TEST-001: Enterprise Server Infrastructure ($250,000) - 3 vendors attached');
    logger.info('RFQ-TEST-002: Office Supplies Bulk Order ($35,000) - 2 vendors attached');
    logger.info('RFQ-TEST-003: Steel & Aluminum Raw Materials ($500,000) - 2 vendors attached');
    logger.info('RFQ-TEST-004: Enterprise Software License Renewal ($75,000) - 2 vendors attached');
    logger.info('');
    logger.info('=== Vendor Portal Links ===');
    logger.info(`Portal URL: ${env.vendorPortalUrl}`);
    logger.info(`Chatbot URL: ${env.chatbotFrontendUrl}`);
    logger.info('');
    if (!sendEmails) {
      logger.info('NOTE: Emails were NOT sent. Set SEED_SEND_EMAILS=true to send vendor emails.');
    } else {
      logger.info('Vendor notification emails have been sent!');
    }
    logger.info('');
  } catch (error) {
    logger.error('Error running seeders:', error);
    throw error;
  }
}

export default seedAll;
