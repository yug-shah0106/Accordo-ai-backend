'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Companies', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      companyName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      companyLogo: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      apiKey: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      apiSecret: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      establishmentDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      nature: {
        type: Sequelize.ENUM('Domestic', 'Interational', 'International'),
        allowNull: true,
      },
      type: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      numberOfEmployees: {
        type: Sequelize.ENUM('0-10', '10-100', '100-1000', '1000+'),
        allowNull: true,
      },
      annualTurnover: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      industryType: {
        type: Sequelize.ENUM(
          'Construction',
          'Healthcare',
          'Transportation',
          'Information Technology',
          'Oil and Gas',
          'Defence',
          'Renewable Energy',
          'Telecommunication',
          'Agriculture',
          'Other'
        ),
        allowNull: true,
      },
      customIndustryType: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      gstNumber: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      gstFileUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      panNumber: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      panFileUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      msmeNumber: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      msmeFileUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      ciNumber: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      ciFileUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      pocName: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      pocDesignation: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      pocEmail: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      pocPhone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      pocWebsite: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      escalationName: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      escalationDesignation: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      escalationEmail: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      escalationPhone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      typeOfCurrency: {
        type: Sequelize.ENUM('INR', 'USD', 'EUR'),
        allowNull: true,
      },
      bankName: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      beneficiaryName: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      accountNumber: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      iBanNumber: {
        type: Sequelize.STRING(34),
        allowNull: true,
      },
      swiftCode: {
        type: Sequelize.STRING(11),
        allowNull: true,
      },
      bankAccountType: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      cancelledCheque: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      cancelledChequeURL: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      ifscCode: {
        type: Sequelize.STRING(11),
        allowNull: true,
      },
      taxInPercentage: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      fullAddress: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Companies');
  },
};
