"use strict";

/** @type {import('sequelize-cli').Migration} */
const tName = "Companies";
module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addColumn(
          tName,
          "companyLogo",
          {
            type: Sequelize.STRING,
          },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "apiKey",
          {
            type: Sequelize.STRING(150),
          },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "apiSecret",
          {
            type: Sequelize.STRING(150),
          },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "establishmentDate",
          {
            type: Sequelize.DATE,
          },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "nature",
          {
            type: Sequelize.ENUM("Domestic", "Interational"),
          },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "type",
          { type: Sequelize.STRING(150)},
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "numberOfEmployees",
          { type: Sequelize.ENUM("0-10", "10-100", "100-1000", "1000+") },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "annualTurnover",
          { type: Sequelize.STRING },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "industryType",
          { type: Sequelize.ENUM("Industry1", "Industry2") },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "gstNumber",
          { type: Sequelize.STRING(100) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "gstFileUrl",
          { type: Sequelize.STRING },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "panNumber",
          { type: Sequelize.STRING(100) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "panFileUrl",
          { type: Sequelize.STRING },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "msmeNumber",
          { type: Sequelize.STRING(100) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "msmeFileUrl",
          { type: Sequelize.STRING },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "ciNumber",
          { type: Sequelize.STRING(100) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "ciFileUrl",
          { type: Sequelize.STRING },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "pocName",
          { type: Sequelize.STRING(100) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "pocDesignation",
          { type: Sequelize.STRING(100) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "pocEmail",
          { type: Sequelize.STRING(100) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "pocPhone",
          { type: Sequelize.STRING(20) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "pocWebsite",
          { type: Sequelize.STRING },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "escalationName",
          { type: Sequelize.STRING(100) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "escalationDesignation",
          { type: Sequelize.STRING(100) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "escalationEmail",
          { type: Sequelize.STRING(100) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "escalationPhone",
          { type: Sequelize.STRING(20) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "typeOfCurrency",
          { type: Sequelize.ENUM("INR", "USD", "EUR") },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "bankName",
          { type: Sequelize.STRING(100) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "beneficiaryName",
          { type: Sequelize.STRING(100) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "accountNumber",
          { type: Sequelize.STRING(20) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "iBanNumber",
          {
            type: Sequelize.STRING(34),
          },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "swiftCode",
          { type: Sequelize.STRING(11) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "bankAccountType",
          {
            type: Sequelize.STRING(50),
          },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "cancelledCheque",
          {
            type: Sequelize.STRING,
          },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "cancelledChequeURL",
          {
            type: Sequelize.STRING,
          },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "ifscCode",
          { type: Sequelize.STRING(11) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "taxInPercentage",
          { type: Sequelize.DOUBLE(5, 2) },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "fullAddress",
          { type: Sequelize.STRING },
          { transaction: t }
        ),
        queryInterface.addColumn(
          tName,
          "createdBy",
          { type: Sequelize.INTEGER },
          { transaction: t }
        ),
      ]);
    });
  },
  
  down(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.removeColumn(tName, "updatedAt", { transaction: t }),
        queryInterface.removeColumn(tName, "companyLogo", { transaction: t }),
        queryInterface.removeColumn(tName, "apiKey", { transaction: t }),
        queryInterface.removeColumn(tName, "apiSecret", { transaction: t }),
        queryInterface.removeColumn(tName, "establishmentDate", {
          transaction: t,
        }),
        queryInterface.removeColumn(tName, "nature", { transaction: t }),
        queryInterface.removeColumn(tName, "type", { transaction: t }),
        queryInterface.removeColumn(tName, "numberOfEmployees", {
          transaction: t,
        }),
        queryInterface.removeColumn(tName, "annualTurnover", {
          transaction: t,
        }),
        queryInterface.removeColumn(tName, "industryType", { transaction: t }),
        queryInterface.removeColumn(tName, "gstNumber", { transaction: t }),
        queryInterface.removeColumn(tName, "gstFileUrl", { transaction: t }),
        queryInterface.removeColumn(tName, "panNumber", { transaction: t }),
        queryInterface.removeColumn(tName, "panFileUrl", { transaction: t }),
        queryInterface.removeColumn(tName, "msmeNumber", { transaction: t }),
        queryInterface.removeColumn(tName, "msmeFileUrl", { transaction: t }),
        queryInterface.removeColumn(tName, "ciNumber", { transaction: t }),
        queryInterface.removeColumn(tName, "ciFileUrl", { transaction: t }),
        queryInterface.removeColumn(tName, "pocName", { transaction: t }),
        queryInterface.removeColumn(tName, "pocDesignation", {
          transaction: t,
        }),
        queryInterface.removeColumn(tName, "pocEmail", { transaction: t }),
        queryInterface.removeColumn(tName, "pocPhone", { transaction: t }),
        queryInterface.removeColumn(tName, "pocWebsite", { transaction: t }),
        queryInterface.removeColumn(tName, "escalationName", {
          transaction: t,
        }),
        queryInterface.removeColumn(tName, "escalationDesignation", {
          transaction: t,
        }),
        queryInterface.removeColumn(tName, "escalationEmail", {
          transaction: t,
        }),
        queryInterface.removeColumn(tName, "escalationPhone", {
          transaction: t,
        }),
        queryInterface.removeColumn(tName, "typeOfCurrency", {
          transaction: t,
        }),
        queryInterface.removeColumn(tName, "bankName", { transaction: t }),
        queryInterface.removeColumn(tName, "beneficiaryName", {
          transaction: t,
        }),
        queryInterface.removeColumn(tName, "accountNumber", { transaction: t }),
        queryInterface.removeColumn(tName, "iBanNumber", { transaction: t }),
        queryInterface.removeColumn(tName, "swiftCode", { transaction: t }),
        queryInterface.removeColumn(tName, "bankAccountType", {
          transaction: t,
        }),
        queryInterface.removeColumn(tName, "cancelledChequeURL", {
          transaction: t,
        }),
        queryInterface.removeColumn(tName, "ifscCode", { transaction: t }),
        queryInterface.removeColumn(tName, "taxInPercentage", {
          transaction: t,
        }),
        queryInterface.removeColumn(tName, "fullAddress", { transaction: t }),
        queryInterface.removeColumn(tName, "createdBy", { transaction: t }),
      ]);
    });
  },
};
