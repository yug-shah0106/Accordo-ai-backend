#!/usr/bin/env tsx
/**
 * Fix All Vendors - Ensure all vendors have company associations
 *
 * This script finds all vendors without company associations and associates them
 * with the first available company.
 *
 * Usage: npx tsx src/scripts/fix-all-vendors.ts
 */
import models from '../models/index.js';
import sequelize from '../config/database.js';
import logger from '../config/logger.js';
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
async function fixAllVendors() {
    try {
        console.log('\n' + '='.repeat(80));
        console.log(`${colors.bright}${colors.cyan}FIX ALL VENDORS - COMPANY ASSOCIATIONS${colors.reset}`);
        console.log('='.repeat(80) + '\n');
        // Connect to database
        await sequelize.authenticate();
        console.log(`${colors.green}✓${colors.reset} Database connected\n`);
        // Get all vendors
        const allVendors = await models.User.findAll({
            where: { userType: 'vendor' },
            attributes: ['id', 'name', 'email', 'companyId'],
        });
        console.log(`${colors.blue}→${colors.reset} Found ${colors.cyan}${allVendors.length}${colors.reset} total vendors\n`);
        if (allVendors.length === 0) {
            console.log(`${colors.yellow}No vendors found in database${colors.reset}\n`);
            process.exit(0);
        }
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
        const defaultCompany = companies[0];
        console.log(`${colors.blue}→${colors.reset} Using default company: ${colors.cyan}${defaultCompany.companyName}${colors.reset} (ID: ${defaultCompany.id})\n`);
        // Find vendors without VendorCompany associations
        const vendorsWithoutCompany = [];
        for (const vendor of allVendors) {
            const vendorCompany = await models.VendorCompany.findOne({
                where: { vendorId: vendor.id },
            });
            if (!vendorCompany) {
                vendorsWithoutCompany.push(vendor);
            }
        }
        console.log(`${colors.yellow}⚠ Found ${vendorsWithoutCompany.length} vendors without company associations${colors.reset}\n`);
        if (vendorsWithoutCompany.length === 0) {
            console.log(`${colors.green}✓ All vendors have company associations!${colors.reset}\n`);
            process.exit(0);
        }
        // Display vendors without company
        console.log('Vendors without company association:');
        vendorsWithoutCompany.forEach((vendor, index) => {
            console.log(`  ${index + 1}. [ID: ${colors.cyan}${vendor.id}${colors.reset}] ${vendor.name || 'No Name'} (${vendor.email})`);
        });
        console.log('');
        // Fix each vendor
        let fixedCount = 0;
        let errorCount = 0;
        for (const vendor of vendorsWithoutCompany) {
            try {
                console.log(`${colors.blue}→${colors.reset} Fixing vendor ID ${colors.cyan}${vendor.id}${colors.reset} (${vendor.email})...`);
                // Create VendorCompany association
                await models.VendorCompany.create({
                    vendorId: vendor.id,
                    companyId: defaultCompany.id,
                });
                // Update vendor's companyId
                await vendor.update({
                    companyId: defaultCompany.id,
                });
                console.log(`  ${colors.green}✓${colors.reset} Fixed\n`);
                fixedCount++;
            }
            catch (error) {
                console.log(`  ${colors.red}✗${colors.reset} Error: ${error.message}\n`);
                errorCount++;
            }
        }
        // Summary
        console.log('='.repeat(80));
        console.log(`${colors.bright}${colors.green}FIX SUMMARY${colors.reset}`);
        console.log('='.repeat(80));
        console.log(`Total vendors: ${colors.cyan}${allVendors.length}${colors.reset}`);
        console.log(`Vendors needing fix: ${colors.yellow}${vendorsWithoutCompany.length}${colors.reset}`);
        console.log(`Successfully fixed: ${colors.green}${fixedCount}${colors.reset}`);
        console.log(`Errors: ${errorCount > 0 ? colors.red : colors.green}${errorCount}${colors.reset}`);
        console.log(`All vendors now associated with: ${colors.cyan}${defaultCompany.companyName}${colors.reset}`);
        console.log('='.repeat(80));
        console.log(`\n${colors.bright}${colors.green}✓ All vendors should now be visible in the vendor management view!${colors.reset}\n`);
        logger.info('All vendors fixed', {
            totalVendors: allVendors.length,
            fixedCount,
            errorCount,
        });
        process.exit(0);
    }
    catch (error) {
        console.error(`\n${colors.red}${colors.bright}✗ Error fixing vendors:${colors.reset}`, error);
        logger.error('Failed to fix vendors', { error });
        process.exit(1);
    }
}
// Run the script
fixAllVendors();
//# sourceMappingURL=fix-all-vendors.js.map