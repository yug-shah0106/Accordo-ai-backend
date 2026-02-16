'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Contracts', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      companyId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Companies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      requisitionId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Requisitions',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      vendorId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'User',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      status: {
        type: Sequelize.ENUM(
          'Created', 'Active', 'Opened', 'Completed', 'Verified',
          'Accepted', 'Rejected', 'Expired', 'Escalated', 'InitialQuotation'
        ),
        allowNull: true,
        defaultValue: 'Created',
      },
      uniqueToken: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      contractDetails: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      finalContractDetails: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      openedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      verifiedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      acceptedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      rejectedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      updatedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      quotedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      benchmarkRating: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      finalRating: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      chatbotDealId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      previousContractId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Contracts');
  },
};
