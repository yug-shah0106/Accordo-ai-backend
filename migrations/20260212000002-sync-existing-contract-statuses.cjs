'use strict';

/**
 * Migration: Sync existing contract statuses based on their linked deal statuses
 *
 * This retroactive migration updates contracts to match their deal's terminal state:
 * - NEGOTIATING → Active
 * - ACCEPTED → Accepted
 * - WALKED_AWAY → Rejected
 * - ESCALATED → Escalated
 *
 * Updates contracts that have status 'Created' or 'InitialQuotation' (pre-negotiation statuses).
 * Uses both chatbotDealId (on contract) and contract_id (on deal) for matching.
 *
 * Note: Table names use mixed casing - "Contracts" (PascalCase) and chatbot_deals (snake_case)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Method 1: Update contracts via chatbotDealId link
    // Note: chatbotDealId is stored as text, deals.id is UUID - need to cast
    const [results1] = await queryInterface.sequelize.query(`
      UPDATE "Contracts" c
      SET status = CASE
        WHEN d.status = 'NEGOTIATING' THEN 'Active'
        WHEN d.status = 'ACCEPTED' THEN 'Accepted'
        WHEN d.status = 'WALKED_AWAY' THEN 'Rejected'
        WHEN d.status = 'ESCALATED' THEN 'Escalated'
        ELSE c.status
      END
      FROM chatbot_deals d
      WHERE c."chatbotDealId"::uuid = d.id
        AND d.status IN ('NEGOTIATING', 'ACCEPTED', 'WALKED_AWAY', 'ESCALATED')
        AND c.status IN ('Created', 'InitialQuotation')
      RETURNING c.id, c.status, d.id as deal_id, d.status as deal_status;
    `);

    console.log(`[Method 1: chatbotDealId] Synced ${results1?.length || 0} contracts`);
    if (results1?.length > 0) {
      console.log('Updated contracts (via chatbotDealId):', results1.slice(0, 5));
    }

    // Method 2: Update contracts via contract_id link (deals point to contracts)
    // Uses latest deal for each contract to handle multiple deals per contract
    const [results2] = await queryInterface.sequelize.query(`
      UPDATE "Contracts" c
      SET status = CASE
        WHEN latest.status = 'NEGOTIATING' THEN 'Active'
        WHEN latest.status = 'ACCEPTED' THEN 'Accepted'
        WHEN latest.status = 'WALKED_AWAY' THEN 'Rejected'
        WHEN latest.status = 'ESCALATED' THEN 'Escalated'
        ELSE c.status
      END
      FROM (
        SELECT DISTINCT ON (contract_id) contract_id, status
        FROM chatbot_deals
        WHERE contract_id IS NOT NULL
          AND status IN ('NEGOTIATING', 'ACCEPTED', 'WALKED_AWAY', 'ESCALATED')
        ORDER BY contract_id, created_at DESC
      ) latest
      WHERE c.id = latest.contract_id
        AND c.status IN ('Created', 'InitialQuotation')
      RETURNING c.id, c.status;
    `);

    console.log(`[Method 2: contract_id] Synced ${results2?.length || 0} additional contracts`);
    if (results2?.length > 0) {
      console.log('Updated contracts (via contract_id):', results2.slice(0, 5));
    }

    const totalSynced = (results1?.length || 0) + (results2?.length || 0);
    console.log(`Total contracts synced: ${totalSynced}`);
  },

  async down(queryInterface, Sequelize) {
    // Revert synced contracts back to InitialQuotation (safer than Created
    // since vendors may have already submitted quotes)
    const [results] = await queryInterface.sequelize.query(`
      UPDATE "Contracts"
      SET status = 'InitialQuotation'
      WHERE status IN ('Active', 'Escalated')
        AND ("chatbotDealId" IS NOT NULL OR id IN (SELECT contract_id FROM chatbot_deals WHERE contract_id IS NOT NULL))
      RETURNING id, status;
    `);

    console.log(`Reverted ${results?.length || 0} contracts back to InitialQuotation status`);
  }
};
