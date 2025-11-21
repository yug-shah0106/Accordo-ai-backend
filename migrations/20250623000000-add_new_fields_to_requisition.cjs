"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add maximum_price to RequisitionProducts table
    await queryInterface.addColumn("RequisitionProducts", "maximum_price", {
      type: Sequelize.DOUBLE,
      allowNull: true,
    });

    // Add payment_terms field to Requisitions
    await queryInterface.addColumn("Requisitions", "payment_terms", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Add net_payment_day field to Requisitions
    await queryInterface.addColumn("Requisitions", "net_payment_day", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Add pre_payment_percentage field to Requisitions
    await queryInterface.addColumn("Requisitions", "pre_payment_percentage", {
      type: Sequelize.DOUBLE,
      allowNull: true,
    });

    // Add post_payment_percentage field to Requisitions
    await queryInterface.addColumn("Requisitions", "post_payment_percentage", {
      type: Sequelize.DOUBLE,
      allowNull: true,
    });

    // Add maxDeliveryDate field to Requisitions
    await queryInterface.addColumn("Requisitions", "maxDeliveryDate", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Add pricePriority field to Requisitions
    await queryInterface.addColumn("Requisitions", "pricePriority", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Add deliveryPriority field to Requisitions
    await queryInterface.addColumn("Requisitions", "deliveryPriority", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Add paymentTermsPriority field to Requisitions
    await queryInterface.addColumn("Requisitions", "paymentTermsPriority", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove all added columns in reverse order
    await queryInterface.removeColumn("Requisitions", "paymentTermsPriority");
    await queryInterface.removeColumn("Requisitions", "deliveryPriority");
    await queryInterface.removeColumn("Requisitions", "pricePriority");
    await queryInterface.removeColumn("Requisitions", "maxDeliveryDate");
    await queryInterface.removeColumn("Requisitions", "post_payment_percentage");
    await queryInterface.removeColumn("Requisitions", "pre_payment_percentage");
    await queryInterface.removeColumn("Requisitions", "net_payment_day");
    await queryInterface.removeColumn("Requisitions", "payment_terms");
    await queryInterface.removeColumn("RequisitionProducts", "maximum_price");
  },
}; 