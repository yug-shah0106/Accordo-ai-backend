'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add FK from Roles.createdBy -> User.id (circular dependency with User.roleId -> Roles.id)
    await queryInterface.addConstraint('Roles', {
      fields: ['createdBy'],
      type: 'foreign key',
      name: 'fk_roles_created_by_user',
      references: {
        table: 'User',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addConstraint('Roles', {
      fields: ['updatedBy'],
      type: 'foreign key',
      name: 'fk_roles_updated_by_user',
      references: {
        table: 'User',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeConstraint('Roles', 'fk_roles_created_by_user');
    await queryInterface.removeConstraint('Roles', 'fk_roles_updated_by_user');
  },
};
