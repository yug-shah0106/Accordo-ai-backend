'use strict';

/**
 * Migration: Rename approval level roles to business-friendly names
 *
 * Changes:
 * - L1 Approver -> Procurement Manager Approver
 * - L2 Approver -> HOD Approver
 * - L3 Approver -> CFO Approver
 *
 * Also updates seeded user names to match the new role naming convention.
 *
 * Note: The underlying approval level enum values (L1, L2, L3) remain unchanged.
 * Only the display names (Role.name and User.name) are updated.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Update Role names
    // Note: We use 'Procurement Manager Approver' instead of 'Procurement Manager'
    // to avoid conflict with existing 'Procurement Manager' role (id: 2)
    await queryInterface.bulkUpdate('Roles',
      { name: 'Procurement Manager Approver' },
      { name: 'L1 Approver' }
    );
    await queryInterface.bulkUpdate('Roles',
      { name: 'HOD Approver' },
      { name: 'L2 Approver' }
    );
    await queryInterface.bulkUpdate('Roles',
      { name: 'CFO Approver' },
      { name: 'L3 Approver' }
    );

    // Update seeded User names to match new convention
    // These are the test users created by the seeder
    await queryInterface.bulkUpdate('User',
      { name: 'Tom - Procurement Manager' },
      { name: 'L1 Approver - Tom' }
    );
    await queryInterface.bulkUpdate('User',
      { name: 'Sarah - HOD' },
      { name: 'L2 Approver - Sarah' }
    );
    await queryInterface.bulkUpdate('User',
      { name: 'Michael - CFO' },
      { name: 'L3 Approver - Michael (CFO)' }
    );
    await queryInterface.bulkUpdate('User',
      { name: 'Lisa - Procurement Manager' },
      { name: 'L1 Approver - Lisa' }
    );
  },

  async down(queryInterface, Sequelize) {
    // Revert Role names
    await queryInterface.bulkUpdate('Roles',
      { name: 'L1 Approver' },
      { name: 'Procurement Manager Approver' }
    );
    await queryInterface.bulkUpdate('Roles',
      { name: 'L2 Approver' },
      { name: 'HOD Approver' }
    );
    await queryInterface.bulkUpdate('Roles',
      { name: 'L3 Approver' },
      { name: 'CFO Approver' }
    );

    // Revert User names
    await queryInterface.bulkUpdate('User',
      { name: 'L1 Approver - Tom' },
      { name: 'Tom - Procurement Manager' }
    );
    await queryInterface.bulkUpdate('User',
      { name: 'L2 Approver - Sarah' },
      { name: 'Sarah - HOD' }
    );
    await queryInterface.bulkUpdate('User',
      { name: 'L3 Approver - Michael (CFO)' },
      { name: 'Michael - CFO' }
    );
    await queryInterface.bulkUpdate('User',
      { name: 'L1 Approver - Lisa' },
      { name: 'Lisa - Procurement Manager' }
    );
  }
};
