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
      { id: 3, name: 'L1 Approver', companyId: 1, isArchived: false },
      { id: 4, name: 'L2 Approver', companyId: 1, isArchived: false },
      { id: 5, name: 'L3 Approver', companyId: 1, isArchived: false },
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

    // L1 Approver - can view and approve requisitions up to $50,000
    const l1ApproverPermissions = [
      { roleId: 3, moduleId: 1, permission: 1 },  // Dashboard - read
      { roleId: 3, moduleId: 4, permission: 3 },  // Requisitions - read/write
      { roleId: 3, moduleId: 6, permission: 7 },  // Approvals - read/write/update
    ];

    // L2 Approver - can view and approve requisitions up to $250,000
    const l2ApproverPermissions = [
      { roleId: 4, moduleId: 1, permission: 1 },  // Dashboard - read
      { roleId: 4, moduleId: 4, permission: 3 },  // Requisitions - read/write
      { roleId: 4, moduleId: 6, permission: 7 },  // Approvals - read/write/update
    ];

    // L3 Approver - can view and approve all requisitions
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
      // L1 Approver - can approve up to $50,000
      {
        id: 3,
        name: 'L1 Approver - Tom',
        email: 'l1.approver@accordo.ai',
        password: defaultPassword,
        userType: 'customer' as const,
        companyId: 1,
        roleId: 3,
        status: 'active',
        approvalLevel: 'L1' as const,
        approvalLimit: 50000,
      },
      // L2 Approver - can approve up to $250,000
      {
        id: 4,
        name: 'L2 Approver - Sarah',
        email: 'l2.approver@accordo.ai',
        password: defaultPassword,
        userType: 'customer' as const,
        companyId: 1,
        roleId: 4,
        status: 'active',
        approvalLevel: 'L2' as const,
        approvalLimit: 250000,
      },
      // L3 Approver - can approve any amount (CFO level)
      {
        id: 5,
        name: 'L3 Approver - Michael (CFO)',
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
      // Additional L1 Approver for testing reassignment
      {
        id: 8,
        name: 'L1 Approver - Lisa',
        email: 'l1.approver2@accordo.ai',
        password: defaultPassword,
        userType: 'customer' as const,
        companyId: 1,
        roleId: 3,
        status: 'active',
        approvalLevel: 'L1' as const,
        approvalLimit: 50000,
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
    ];

    for (const { contract, deal } of contractsData) {
      // Check if contract already exists
      const existingContract = await Contract.findByPk(contract.id);
      if (existingContract) {
        logger.info(`Contract ${contract.id} already exists, skipping...`);
        continue;
      }

      // Create the chatbot deal first
      const [createdDeal] = await ChatbotDeal.findOrCreate({
        where: { id: deal.id },
        defaults: deal,
      });

      // Create the contract with the deal ID
      const contractWithDeal = {
        ...contract,
        chatbotDealId: createdDeal.id,
      };

      const [createdContract] = await Contract.findOrCreate({
        where: { id: contract.id },
        defaults: contractWithDeal,
      });

      // Update the deal with the contract ID
      await ChatbotDeal.update(
        { contractId: createdContract.id },
        { where: { id: createdDeal.id } }
      );

      // Send email to vendor if enabled
      if (sendEmails) {
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
              createdDeal.id
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
    logger.info('Admin:           admin@accordo.ai / password123');
    logger.info('Procurement:     jane.procurement@accordo.ai / password123');
    logger.info('L1 Approver:     l1.approver@accordo.ai / password123 (limit: $50,000)');
    logger.info('L2 Approver:     l2.approver@accordo.ai / password123 (limit: $250,000)');
    logger.info('L3 Approver:     l3.approver@accordo.ai / password123 (limit: $10,000,000)');
    logger.info('Vendor 1:        sales@techsupply.com / password123');
    logger.info('Vendor 2:        accounts@globalparts.eu / password123');
    logger.info('');
    logger.info('=== Requisitions Created ===');
    logger.info('RFQ0001: IT Equipment Procurement ($75,000) - 2 vendors attached');
    logger.info('RFQ0002: Office Furniture ($45,000) - 1 vendor attached');
    logger.info('RFQ0003: Annual Software Licenses ($15,000) - 1 vendor attached');
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
