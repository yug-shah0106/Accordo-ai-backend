import { expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import sequelize from '../config/database.js';

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Use test database
process.env.DB_NAME = process.env.DB_NAME_TEST || 'accordo_test';

// Set JWT secrets for testing
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-secret-key';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key';

/**
 * Before all tests, sync database
 */
beforeAll(async () => {
  try {
    // Authenticate connection
    await sequelize.authenticate();
    console.log('✓ Database connection established for testing');

    // Sync all models (force: true drops and recreates tables)
    await sequelize.sync({ force: true });
    console.log('✓ Database schema synced for testing');
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
});

/**
 * After each test, clean up data
 */
afterEach(async () => {
  // Truncate all tables to ensure clean state for next test
  try {
    const models = Object.values(sequelize.models);
    for (const model of models) {
      await model.destroy({ where: {}, truncate: true, cascade: true });
    }
  } catch (error) {
    console.error('Failed to clean up test data:', error);
  }
});

/**
 * After all tests, close database connection
 */
afterAll(async () => {
  try {
    await sequelize.close();
    console.log('✓ Database connection closed');
  } catch (error) {
    console.error('Failed to close database connection:', error);
  }
});

// Export expect for convenience
export { expect };
