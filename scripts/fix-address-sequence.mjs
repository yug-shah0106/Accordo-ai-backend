import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function fixSequences() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'accordo',
    password: process.env.DB_PASSWORD || 'accordo',
    database: process.env.DB_NAME || 'accordo_mvp',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Fix Addresses sequence
    const addressResult = await client.query(`
      SELECT setval('"Addresses_id_seq"', COALESCE((SELECT MAX(id) FROM "Addresses"), 0) + 1, false);
    `);
    console.log('Addresses sequence reset:', addressResult.rows[0]);

    // Also check and fix other potentially affected sequences
    const tables = ['User', 'Companies', 'Addresses', 'VendorCompany'];
    
    for (const table of tables) {
      try {
        const seqName = `"${table}_id_seq"`;
        const tableName = table === 'User' ? '"User"' : `"${table}"`;
        
        const result = await client.query(`
          SELECT setval('${seqName}', COALESCE((SELECT MAX(id) FROM ${tableName}), 0) + 1, false);
        `);
        console.log(`${table} sequence reset:`, result.rows[0]);
      } catch (e) {
        console.log(`Could not reset ${table} sequence:`, e.message);
      }
    }

    console.log('All sequences fixed!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

fixSequences();
