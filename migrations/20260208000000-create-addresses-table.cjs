'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable('Addresses', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Companies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      label: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      address: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      city: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      state: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      postalCode: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('Addresses', ['companyId']);
    await queryInterface.addIndex('Addresses', ['companyId', 'isDefault']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Addresses');
  },
};
