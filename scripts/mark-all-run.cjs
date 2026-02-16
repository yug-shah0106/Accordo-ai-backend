'use strict';

/**
 * Helper script: Mark all consolidated migrations as already run.
 *
 * Usage (on an EXISTING database where tables already exist via auto-sync):
 *   node scripts/mark-all-run.cjs
 *
 * This clears the SequelizeMeta table and inserts all 40 migration filenames
 * so that `npx sequelize-cli db:migrate` reports "No migrations were executed".
 */

const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const MIGRATIONS = [
  '20260217000001-create-companies.cjs',
  '20260217000002-create-modules.cjs',
  '20260217000003-create-chatbot-templates.cjs',
  '20260217000004-create-preferences.cjs',
  '20260217000005-create-negotiation-patterns.cjs',
  '20260217000006-create-vector-migration-status.cjs',
  '20260217000007-create-api-usage-logs.cjs',
  '20260217000008-create-roles.cjs',
  '20260217000009-create-users.cjs',
  '20260217000010-create-chatbot-template-parameters.cjs',
  '20260217000011-create-auth-tokens.cjs',
  '20260217000012-create-otps.cjs',
  '20260217000013-create-products.cjs',
  '20260217000014-create-projects.cjs',
  '20260217000015-create-vendor-companies.cjs',
  '20260217000016-create-user-actions.cjs',
  '20260217000017-create-role-permissions.cjs',
  '20260217000018-create-addresses.cjs',
  '20260217000019-create-project-pocs.cjs',
  '20260217000020-create-requisitions.cjs',
  '20260217000021-create-email-logs.cjs',
  '20260217000022-create-contracts.cjs',
  '20260217000023-create-requisition-products.cjs',
  '20260217000024-create-requisition-attachments.cjs',
  '20260217000025-create-negotiations.cjs',
  '20260217000026-create-approvals.cjs',
  '20260217000027-create-negotiation-rounds.cjs',
  '20260217000028-create-chat-sessions.cjs',
  '20260217000029-create-pos.cjs',
  '20260217000030-create-chatbot-deals.cjs',
  '20260217000031-create-chatbot-messages.cjs',
  '20260217000032-create-negotiation-training-data.cjs',
  '20260217000033-create-vendor-bids.cjs',
  '20260217000034-create-deal-embeddings.cjs',
  '20260217000035-create-message-embeddings.cjs',
  '20260217000036-create-bid-comparisons.cjs',
  '20260217000037-create-bid-action-histories.cjs',
  '20260217000038-create-vendor-selections.cjs',
  '20260217000039-create-vendor-notifications.cjs',
  '20260217000040-add-deferred-foreign-keys.cjs',
];

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'accordo',
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // Ensure SequelizeMeta table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
        "name" VARCHAR(255) NOT NULL UNIQUE PRIMARY KEY
      );
    `);

    // Clear old entries
    const deleteResult = await client.query('DELETE FROM "SequelizeMeta"');
    console.log(`Cleared ${deleteResult.rowCount} old migration records.`);

    // Insert all new migration names
    const values = MIGRATIONS.map((name) => `('${name}')`).join(',\n  ');
    await client.query(`INSERT INTO "SequelizeMeta" ("name") VALUES\n  ${values};`);
    console.log(`Inserted ${MIGRATIONS.length} migration records.`);

    console.log('\nDone! Run "npx sequelize-cli db:migrate" to verify — it should say "No migrations were executed".');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
