#!/usr/bin/env tsx
/**
 * Fix Vendor - Add VendorCompany association
 *
 * This script associates the vendor with a company so they appear in the vendor management view
 *
 * Usage: npx tsx src/scripts/fix-vendor-company.ts
 */

import models from '../models/index.js';
import sequelize from '../config/database.js';
import logger from '../config/logger.js';

// Vendor details
const VENDOR_EMAIL = 'vatsal.s@deuexsolutions.com';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

async function fixVendorCompany() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log(`${colors.bright}${colors.cyan}FIX VENDOR - ADD COMPANY ASSOCIATION${colors.reset}`);
    console.log('='.repeat(80));
    console.log(`Vendor Email: ${colors.yellow}${VENDOR_EMAIL}${colors.reset}`);
    console.log('='.repeat(80) + '\n');

    // Connect to database
    await sequelize.authenticate();
    console.log(`${colors.green}✓${colors.reset} Database connected\n`);

    // Find the vendor
    const vendor = await models.User.findOne({
      where: { email: VENDOR_EMAIL },
    });

    if (!vendor) {
      console.log(`${colors.red}✗ Vendor not found with email: ${VENDOR_EMAIL}${colors.reset}\n`);
      process.exit(1);
    }

    console.log(`${colors.green}✓${colors.reset} Vendor found (ID: ${colors.cyan}${vendor.id}${colors.reset})\n`);

    // Get all companies
    const companies = await models.Company.findAll({
      attributes: ['id', 'companyName'],
      limit: 10,
    });

    if (!companies || companies.length === 0) {
      console.log(`${colors.red}✗ No companies found in database${colors.reset}`);
      console.log(`${colors.yellow}Please create a company first${colors.reset}\n`);
      process.exit(1);
    }

    console.log(`${colors.blue}→${colors.reset} Found ${colors.cyan}${companies.length}${colors.reset} companies:\n`);
    companies.forEach((company: any, index: number) => {
      console.log(`  ${index + 1}. [ID: ${colors.cyan}${company.id}${colors.reset}] ${company.companyName}`);
    });
    console.log('');

    // Use the first company as default
    const defaultCompany = companies[0] as any;
    console.log(`${colors.blue}→${colors.reset} Using company: ${colors.cyan}${defaultCompany.companyName}${colors.reset} (ID: ${defaultCompany.id})\n`);

    // Check if VendorCompany association already exists
    const existingVendorCompany = await models.VendorCompany.findOne({
      where: {
        vendorId: vendor.id,
      },
    });

    if (existingVendorCompany) {
      const existingCompanyId = (existingVendorCompany as any).companyId;
      console.log(`${colors.yellow}⚠ VendorCompany association already exists!${colors.reset}`);
      console.log(`  Vendor ID: ${colors.cyan}${vendor.id}${colors.reset}`);
      console.log(`  Company ID: ${colors.cyan}${existingCompanyId}${colors.reset}\n`);

      // Check if it's the same company
      if (existingCompanyId === defaultCompany.id) {
        console.log(`${colors.green}✓ Vendor is already associated with the correct company!${colors.reset}\n`);
      } else {
        // Update to new company
        console.log(`${colors.blue}→${colors.reset} Updating vendor company association...\n`);
        await existingVendorCompany.update({
          companyId: defaultCompany.id,
        });
        console.log(`${colors.green}✓${colors.reset} Updated to company: ${colors.cyan}${defaultCompany.companyName}${colors.reset}\n`);
      }
    } else {
      // Create new VendorCompany association
      console.log(`${colors.blue}→${colors.reset} Creating VendorCompany association...\n`);
      await models.VendorCompany.create({
        vendorId: vendor.id,
        companyId: defaultCompany.id,
      });
      console.log(`${colors.green}✓${colors.reset} VendorCompany association created!\n`);
    }

    // Update vendor's companyId (optional, for consistency)
    if (vendor.companyId !== defaultCompany.id) {
      console.log(`${colors.blue}→${colors.reset} Updating vendor's companyId field...\n`);
      await vendor.update({
        companyId: defaultCompany.id,
      });
      console.log(`${colors.green}✓${colors.reset} Vendor's companyId updated\n`);
    }

    // Verify the association
    const vendorCompany = await models.VendorCompany.findOne({
      where: { vendorId: vendor.id },
      include: [
        {
          model: models.Company,
          as: 'Company',
          attributes: ['id', 'companyName'],
        },
      ],
    });

    console.log('='.repeat(80));
    console.log(`${colors.bright}${colors.green}VENDOR FIXED SUCCESSFULLY!${colors.reset}`);
    console.log('='.repeat(80));
    console.log(`\nVendor Details:`);
    console.log(`  ${colors.bright}ID:${colors.reset} ${colors.cyan}${vendor.id}${colors.reset}`);
    console.log(`  ${colors.bright}Name:${colors.reset} ${colors.cyan}${vendor.name}${colors.reset}`);
    console.log(`  ${colors.bright}Email:${colors.reset} ${colors.cyan}${vendor.email}${colors.reset}`);
    console.log(`  ${colors.bright}Company ID:${colors.reset} ${colors.cyan}${vendor.companyId}${colors.reset}`);
    console.log(`  ${colors.bright}Company Name:${colors.reset} ${colors.cyan}${(vendorCompany as any)?.Company?.companyName || 'N/A'}${colors.reset}`);
    console.log('\n' + '='.repeat(80));

    console.log(`\n${colors.bright}${colors.green}✓ The vendor should now be visible in the vendor management view!${colors.reset}\n`);
    console.log('='.repeat(80) + '\n');

    logger.info('Vendor company association fixed', {
      vendorId: vendor.id,
      companyId: defaultCompany.id,
    });

    process.exit(0);
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}✗ Error fixing vendor:${colors.reset}`, error);
    logger.error('Failed to fix vendor company association', { error });
    process.exit(1);
  }
}

// Run the script
fixVendorCompany();
