import models from "../models/index.js";

/**
 * Comprehensive seeder for Requisition 6 (RFQT-2024-001)
 * Ensures all related data is seeded: products, preferences, BATNA, etc.
 */
export const seedRequisition6 = async ({ transaction } = {}) => {
  // Find or create the requisition
  const requisition = await models.Requisition.findOne({
    where: { rfqId: "RFQT-2024-001" },
    transaction,
  });

  if (!requisition) {
    console.log("Requisition RFQT-2024-001 not found. Please run datasetSeeder first.");
    return;
  }

  // Find user (createdBy)
  const user = await models.User.findOne({
    where: { id: requisition.createdBy },
    transaction,
  });

  if (!user) {
    console.log("User not found for requisition. Please run userSeeder first.");
    return;
  }

  // Update requisition with BATNA and max discount
  await requisition.update(
    {
      batna: 1200,
      maxDiscount: 20,
      discountedValue: null, // Will be updated during negotiation
      status: "Created",
    },
    { transaction }
  );

  // Find or create products for this requisition
  const products = await models.Product.findAll({
    where: { companyId: user.companyId },
    limit: 3,
    transaction,
  });

  if (products.length === 0) {
    console.log("No products found. Please run productSeeder first.");
    return;
  }

  // Create RequisitionProducts
  const requisitionProducts = [
    {
      requisitionId: requisition.id,
      productId: products[0].id,
      qty: 10,
      targetPrice: 100,
      maximum_price: 120,
      createdBy: user.id,
    },
    {
      requisitionId: requisition.id,
      productId: products[1]?.id || products[0].id,
      qty: 5,
      targetPrice: 50,
      maximum_price: 60,
      createdBy: user.id,
    },
  ];

  for (const rpData of requisitionProducts) {
    await models.RequisitionProduct.findOrCreate({
      where: {
        requisitionId: rpData.requisitionId,
        productId: rpData.productId,
      },
      defaults: rpData,
      transaction,
    });
  }

  // Create preferences with BATNA and max discount
  await models.Preference.findOrCreate({
    where: {
      entityId: user.id,
      entityType: "User",
      context: `requisition_${requisition.id}`,
    },
    defaults: {
      entityId: user.id,
      entityType: "User",
      context: `requisition_${requisition.id}`,
      constraints: {
        batna: 1200,
        maxDiscount: 20,
        maxPrice: 1500,
      },
      weights: {
        price: 0.7,
        delivery: 0.3,
      },
    },
    transaction,
  });

  console.log(`✓ Seeded Requisition 6 (RFQT-2024-001) with:
    - BATNA: 1200
    - Max Discount: 20%
    - Products: ${requisitionProducts.length}
    - Preferences: Set`);

  return requisition;
};




