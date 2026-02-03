/**
 * Script to fix the 'nature' enum typo in Companies table
 * Run with: node scripts/fix-nature-enum.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

const { Client } = pg;

async function fixNatureEnum() {
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    database: process.env.DB_NAME || 'accordo',
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Add the correct 'International' value to the enum
    console.log('Adding "International" to enum_Companies_nature...');
    await client.query(`
      ALTER TYPE "enum_Companies_nature" ADD VALUE IF NOT EXISTS 'International';
    `);
    console.log('Enum value added successfully');

    // Update any existing rows that have the typo
    console.log('Updating any existing rows with typo...');
    const result = await client.query(`
      UPDATE "Companies" SET "nature" = 'International' WHERE "nature" = 'Interational';
    `);
    console.log(`Updated ${result.rowCount} rows`);

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixNatureEnum();
