/**
 * Database Seeders
 * Auto-seed essential data (uses findOrCreate, safe to run multiple times)
 */

import { Module } from '../models/module.js';
import { Role } from '../models/role.js';
import { RolePermission } from '../models/rolePermission.js';
import logger from '../config/logger.js';

/**
 * Seed modules
 */
async function seedModules(): Promise<void> {
  try {
    const modules = [
      { id: 1, name: 'Dashboard', isActive: true },
      { id: 2, name: 'User Management', isActive: true },
      { id: 3, name: 'Projects', isActive: true },
      { id: 4, name: 'Requisitions', isActive: true },
      { id: 5, name: 'Vendors', isActive: true },
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
 * Seed default roles (if needed)
 */
async function seedRoles(): Promise<void> {
  try {
    // Add default roles here if needed
    // Example:
    // await Role.findOrCreate({
    //   where: { name: 'Admin' },
    //   defaults: { name: 'Admin', isActive: true }
    // });

    logger.info('Roles seeded successfully');
  } catch (error) {
    logger.error('Error seeding roles:', error);
    throw error;
  }
}

/**
 * Seed all essential data
 */
export async function seedAll(): Promise<void> {
  try {
    await seedModules();
    await seedRoles();
    logger.info('All seeders completed successfully');
  } catch (error) {
    logger.error('Error running seeders:', error);
    throw error;
  }
}

export default seedAll;
