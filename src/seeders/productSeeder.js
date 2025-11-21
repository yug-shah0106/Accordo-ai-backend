import models from "../models/index.js";

const products = [
  {
    productName: "Test Product 1",
    category: "Test Category",
    brandName: "Test Product Brand",
    gstType: "GST",
    tds: 1000.99,
    type: "Goods",
    UOM: "Test UOM",
    companyName: "Test Company 1",
  },
  {
    productName: "Test Product 2",
    category: "Test Category",
    brandName: "Test Product Brand",
    gstType: "GST",
    tds: 1000.99,
    type: "Goods",
    UOM: "Test UOM",
    companyName: "Test Company 1",
  },
];

export const seedProducts = async ({ transaction } = {}) => {
  for (const product of products) {
    const { companyName, ...productData } = product;
    const company = await models.Company.findOne({
      where: { companyName },
      transaction,
    });
    if (!company) continue;

    await models.Product.findOrCreate({
      where: { productName: productData.productName, companyId: company.id },
      defaults: {
        ...productData,
        companyId: company.id,
      },
      transaction,
    });
  }
};
