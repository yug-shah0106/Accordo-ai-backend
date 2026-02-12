'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('User', 'isProtected', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // Set the super admin user as protected
    await queryInterface.sequelize.query(`
      UPDATE "User" SET "isProtected" = true WHERE email = 'ak75963@gmail.com'
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('User', 'isProtected');
  },
};
