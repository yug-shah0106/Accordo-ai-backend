#!/usr/bin/env tsx
/**
 * Create a Vendor User
 *
 * Usage: npx tsx src/scripts/create-vendor.ts
 */

import bcrypt from 'bcrypt';
import models from '../src/models/index.js';
import sequelize from '../src/config/database.js';
import logger from '../src/config/logger.js';

// Vendor details
const VENDOR_EMAIL = 'vatsal.s@deuexsolutions.com';
const VENDOR_NAME = 'vatsal s';
const VENDOR_PASSWORD = 'Password@123'; // Default password, can be changed later

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

async function createVendor() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log(`${colors.bright}${colors.cyan}CREATE VENDOR USER${colors.reset}`);
    console.log('='.repeat(80));
    console.log(`Email: ${colors.yellow}${VENDOR_EMAIL}${colors.reset}`);
    console.log(`Name: ${colors.yellow}${VENDOR_NAME}${colors.reset}`);
    console.log(`Password: ${colors.yellow}${VENDOR_PASSWORD}${colors.reset}`);
    console.log('='.repeat(80) + '\n');

    // Connect to database
    await sequelize.authenticate();
    console.log(`${colors.green}✓${colors.reset} Database connected\n`);

    // Check if user already exists
    const existingUser = await models.User.findOne({
      where: { email: VENDOR_EMAIL },
    });

    if (existingUser) {
      console.log(`${colors.yellow}⚠ User already exists!${colors.reset}`);
      console.log(`\nUser Details:`);
      console.log(`  ID: ${colors.cyan}${existingUser.id}${colors.reset}`);
      console.log(`  Name: ${colors.cyan}${existingUser.name}${colors.reset}`);
      console.log(`  Email: ${colors.cyan}${existingUser.email}${colors.reset}`);
      console.log(`  User Type: ${colors.cyan}${existingUser.userType}${colors.reset}`);
      console.log(`  Status: ${colors.cyan}${existingUser.status}${colors.reset}`);
      console.log(`  Company ID: ${colors.cyan}${existingUser.companyId || 'None'}${colors.reset}`);

      if (existingUser.userType !== 'vendor') {
        console.log(`\n${colors.red}✗ Error: Existing user is not a vendor (type: ${existingUser.userType})${colors.reset}`);
        console.log(`${colors.yellow}  Please use a different email or update the existing user.${colors.reset}\n`);
        process.exit(1);
      }

      console.log(`\n${colors.green}✓ Vendor user already exists and is ready to use!${colors.reset}\n`);
      console.log('='.repeat(80) + '\n');
      process.exit(0);
    }

    // Hash password
    console.log(`${colors.blue}→${colors.reset} Hashing password...`);
    const hashedPassword = await bcrypt.hash(VENDOR_PASSWORD, 10);
    console.log(`${colors.green}✓${colors.reset} Password hashed\n`);

    // Create vendor user
    console.log(`${colors.blue}→${colors.reset} Creating vendor user...`);
    const vendor = await models.User.create({
      name: VENDOR_NAME,
      email: VENDOR_EMAIL,
      password: hashedPassword,
      userType: 'vendor',
      status: 'active',
      approvalLevel: 'NONE',
      phone: null,
      profilePic: null,
      companyId: null,
      roleId: null,
      approvalLimit: null,
    });

    console.log(`${colors.green}✓${colors.reset} Vendor user created successfully!\n`);

    // Display vendor details
    console.log('='.repeat(80));
    console.log(`${colors.bright}${colors.green}VENDOR CREATED SUCCESSFULLY!${colors.reset}`);
    console.log('='.repeat(80));
    console.log(`\nVendor Details:`);
    console.log(`  ${colors.bright}ID:${colors.reset} ${colors.cyan}${vendor.id}${colors.reset}`);
    console.log(`  ${colors.bright}Name:${colors.reset} ${colors.cyan}${vendor.name}${colors.reset}`);
    console.log(`  ${colors.bright}Email:${colors.reset} ${colors.cyan}${vendor.email}${colors.reset}`);
    console.log(`  ${colors.bright}User Type:${colors.reset} ${colors.cyan}${vendor.userType}${colors.reset}`);
    console.log(`  ${colors.bright}Status:${colors.reset} ${colors.cyan}${vendor.status}${colors.reset}`);
    console.log(`  ${colors.bright}Password:${colors.reset} ${colors.cyan}${VENDOR_PASSWORD}${colors.reset}`);
    console.log('\n' + '='.repeat(80));

    // Instructions
    console.log(`\n${colors.bright}${colors.yellow}NEXT STEPS:${colors.reset}`);
    console.log(`\n1. ${colors.bright}Login Credentials:${colors.reset}`);
    console.log(`   Email: ${colors.cyan}${VENDOR_EMAIL}${colors.reset}`);
    console.log(`   Password: ${colors.cyan}${VENDOR_PASSWORD}${colors.reset}`);

    console.log(`\n2. ${colors.bright}To test vendor emails:${colors.reset}`);
    console.log(`   - Create a requisition in the admin panel`);
    console.log(`   - Add this vendor (ID: ${colors.cyan}${vendor.id}${colors.reset}) to the requisition`);
    console.log(`   - The vendor will receive an email at ${colors.cyan}${VENDOR_EMAIL}${colors.reset}`);

    console.log(`\n3. ${colors.bright}To attach vendor to a requisition via API:${colors.reset}`);
    console.log(`   ${colors.blue}POST /api/contract/create${colors.reset}`);
    console.log(`   Body: {`);
    console.log(`     "requisitionId": <requisition_id>,`);
    console.log(`     "vendorId": ${colors.cyan}${vendor.id}${colors.reset}`);
    console.log(`   }`);

    console.log(`\n4. ${colors.bright}Vendor Portal URL:${colors.reset}`);
    console.log(`   ${colors.cyan}http://localhost:5001/vendor${colors.reset}`);

    console.log('\n' + '='.repeat(80) + '\n');

    logger.info('Vendor user created successfully', {
      vendorId: vendor.id,
      email: vendor.email,
      name: vendor.name,
    });

    process.exit(0);
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}✗ Error creating vendor:${colors.reset}`, error);
    logger.error('Failed to create vendor user', { error });
    process.exit(1);
  }
}

// Run the script
createVendor();
