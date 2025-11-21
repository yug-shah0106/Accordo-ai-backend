import models from "../models/index.js";

const vendorGroups = [
  {
    companyName: "Test Company 1",
    vendors: [
      {
        name: "ABC Electronics Ltd",
        email: "contact@abcelectronics.com",
        phone: "+91-9876543210",
        status: "active",
      },
      {
        name: "XYZ Manufacturing Co",
        email: "info@xyzmanufacturing.com",
        phone: "+91-9876543211",
        status: "active",
      },
      {
        name: "Tech Solutions Inc",
        email: "sales@techsolutions.com",
        phone: "+91-9876543212",
        status: "active",
      },
      {
        name: "Global Supplies Corp",
        email: "orders@globalsupplies.com",
        phone: "+91-9876543213",
        status: "inactive",
      },
      {
        name: "Premium Components Ltd",
        email: "support@premiumcomponents.com",
        phone: "+91-9876543214",
        status: "active",
      },
    ],
  },
  {
    companyName: "Accordo Enterprises Pvt Ltd",
    vendors: [
      {
        name: "Digital Innovations Corp",
        email: "info@digitalinnovations.com",
        phone: "+91-9876543220",
        status: "active",
      },
      {
        name: "Smart Systems Ltd",
        email: "contact@smartsystems.com",
        phone: "+91-9876543221",
        status: "active",
      },
      {
        name: "Future Tech Solutions",
        email: "sales@futuretech.com",
        phone: "+91-9876543222",
        status: "active",
      },
      {
        name: "Innovation Hub Pvt Ltd",
        email: "support@innovationhub.com",
        phone: "+91-9876543223",
        status: "inactive",
      },
    ],
  },
];

export const seedVendors = async ({ transaction } = {}) => {
  for (const group of vendorGroups) {
    const company = await models.Company.findOne({
      where: { companyName: group.companyName },
      transaction,
    });
    if (!company) continue;

    for (const vendor of group.vendors) {
      const [user] = await models.User.findOrCreate({
        where: { email: vendor.email },
        defaults: {
          name: vendor.name,
          email: vendor.email,
          phone: vendor.phone,
          companyId: company.id,
          userType: "vendor",
          status: vendor.status,
        },
        transaction,
      });

      await models.VendorCompany.findOrCreate({
        where: {
          vendorId: user.id,
          companyId: company.id,
        },
        defaults: {
          vendorId: user.id,
          companyId: company.id,
        },
        transaction,
      });
    }
  }
};
