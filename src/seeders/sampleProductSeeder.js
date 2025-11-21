import models from "../models/index.js";

const detailedProducts = [
  {
    productName: "Laptop Dell XPS 13",
    category: "Electronics",
    brandName: "Dell",
    gstType: "GST",
    gstPercentage: 18,
    tds: 1000.99,
    type: "Goods",
    UOM: "Units",
  },
  {
    productName: "Office Chair Ergonomic",
    category: "Furniture",
    brandName: "Herman Miller",
    gstType: "GST",
    gstPercentage: 18,
    tds: 500.5,
    type: "Goods",
    UOM: "Units",
  },
  {
    productName: "Network Switch 24-Port",
    category: "Networking",
    brandName: "Cisco",
    gstType: "GST",
    gstPercentage: 18,
    tds: 2500,
    type: "Goods",
    UOM: "Units",
  },
  {
    productName: "Software License - Microsoft Office",
    category: "Software",
    brandName: "Microsoft",
    gstType: "GST",
    gstPercentage: 18,
    tds: 0,
    type: "Services",
    UOM: "Licenses",
  },
  {
    productName: "Security Camera System",
    category: "Security",
    brandName: "Hikvision",
    gstType: "GST",
    gstPercentage: 18,
    tds: 1500.75,
    type: "Goods",
    UOM: "Units",
  },
  {
    productName: "Air Conditioning Unit",
    category: "HVAC",
    brandName: "Carrier",
    gstType: "GST",
    gstPercentage: 18,
    tds: 5000,
    type: "Goods",
    UOM: "Units",
  },
  {
    productName: "Printer HP LaserJet Pro",
    category: "Office Equipment",
    brandName: "HP",
    gstType: "GST",
    gstPercentage: 18,
    tds: 800.25,
    type: "Goods",
    UOM: "Units",
  },
  {
    productName: "Cloud Storage Service",
    category: "IT Services",
    brandName: "AWS",
    gstType: "GST",
    gstPercentage: 18,
    tds: 0,
    type: "Services",
    UOM: "GB/Month",
  },
  {
    productName: "LED Display Panel 55\"",
    category: "Display",
    brandName: "Samsung",
    gstType: "GST",
    gstPercentage: 18,
    tds: 3000,
    type: "Goods",
    UOM: "Units",
  },
  {
    productName: "Web Development Services",
    category: "IT Services",
    brandName: "Custom",
    gstType: "GST",
    gstPercentage: 18,
    tds: 0,
    type: "Services",
    UOM: "Hours",
  },
];

export const seedSampleProducts = async ({ transaction } = {}) => {
  const company = await models.Company.findOne({
    where: { companyName: "Test Company 1" },
    transaction,
  });
  if (!company) return;

  for (const payload of detailedProducts) {
    await models.Product.findOrCreate({
      where: { productName: payload.productName, companyId: company.id },
      defaults: {
        ...payload,
        companyId: company.id,
      },
      transaction,
    });
  }
};
