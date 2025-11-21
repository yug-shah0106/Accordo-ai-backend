import models from "../models/index.js";
import { hashPassword } from "./utils.js";

const projects = [
  {
    projectName: "Community Connector",
    projectId: "prj-2024-001",
    projectAddress: "Community Connector Noida",
    typeOfProject: "Type1",
    tenureInDays: 10,
    requisitions: [
      {
        rfqId: "RFQT-2024-001",
        subject: "Procurement of Office Supplies",
        category: "Office Supplies",
        deliveryDate: new Date("2024-12-31"),
        negotiationClosureDate: new Date("2024-12-15"),
        typeOfCurrency: "USD",
        totalPrice: 1450,
        payment_terms: "Net 30",
        status: "Created",
        savingsInPrice: 50,
      },
    ],
  },
  {
    projectName: "Neighborhood Network",
    projectId: "prj-2024-002",
    projectAddress: "Neighborhood Network Noida",
    typeOfProject: "Type1",
    tenureInDays: 20,
    requisitions: [
      {
        rfqId: "RFQT-2024-002",
        subject: "IT Equipment Purchase",
        category: "Electronics",
        deliveryDate: new Date("2025-01-15"),
        negotiationClosureDate: new Date("2024-12-20"),
        typeOfCurrency: "INR",
        totalPrice: null,
        payment_terms: "Net 45",
        status: "Created",
        savingsInPrice: null,
      },
    ],
  },
  {
    projectName: "Local Link",
    projectId: "prj-2024-003",
    projectAddress: "Neighborhood Network Noida",
    typeOfProject: "Type2",
    tenureInDays: 30,
    requisitions: [
      {
        rfqId: "RFQT-2024-003",
        subject: "Construction Materials",
        category: "Construction",
        deliveryDate: new Date("2025-02-10"),
        negotiationClosureDate: new Date("2025-01-15"),
        typeOfCurrency: "INR",
        totalPrice: 19500,
        payment_terms: "Net 60",
        status: "Fulfilled",
        savingsInPrice: 500,
      },
      {
        rfqId: "RFQT-2024-004",
        subject: "Marketing Campaign Services",
        category: "Marketing",
        deliveryDate: new Date("2025-03-01"),
        negotiationClosureDate: new Date("2025-02-01"),
        typeOfCurrency: "USD",
        totalPrice: 2900,
        payment_terms: "Net 30",
        status: "Created",
        savingsInPrice: 100,
      },
    ],
  },
  {
    projectName: "Unity Hub",
    projectId: "prj-2024-004",
    projectAddress: "Unity Hub Noida",
    typeOfProject: "Type3",
    tenureInDays: 15,
    requisitions: [
      {
        rfqId: "RFQT-2024-005",
        subject: "Software Development Services",
        category: "IT Services",
        deliveryDate: new Date("2025-04-15"),
        negotiationClosureDate: new Date("2025-03-15"),
        typeOfCurrency: "EUR",
        totalPrice: null,
        payment_terms: "Net 45",
        status: "Created",
        savingsInPrice: null,
      },
      {
        rfqId: "RFQT-2024-006",
        subject: "Office Renovation",
        category: "Construction",
        deliveryDate: new Date("2025-05-20"),
        negotiationClosureDate: new Date("2025-04-20"),
        typeOfCurrency: "INR",
        totalPrice: 14800,
        payment_terms: "Net 60",
        status: "NegotiationStarted",
        savingsInPrice: 200,
      },
    ],
  },
];

export const seedDataset = async ({ transaction } = {}) => {
  const [company] = await models.Company.findOrCreate({
    where: { companyName: "Tst Company" },
    defaults: { companyName: "Tst Company" },
    transaction,
  });

  const hashed = await hashPassword("Test@123");
  const [user] = await models.User.findOrCreate({
    where: { email: "email@gmail.com" },
    defaults: {
      name: "Tst User",
      email: "email@gmail.com",
      password: hashed,
      companyId: company.id,
    },
    transaction,
  });

  for (const projectPayload of projects) {
    const [project] = await models.Project.findOrCreate({
      where: { projectId: projectPayload.projectId },
      defaults: {
        projectName: projectPayload.projectName,
        projectId: projectPayload.projectId,
        projectAddress: projectPayload.projectAddress,
        typeOfProject: projectPayload.typeOfProject,
        tenureInDays: projectPayload.tenureInDays,
        companyId: company.id,
      },
      transaction,
    });

    for (const reqPayload of projectPayload.requisitions) {
      await models.Requisition.findOrCreate({
        where: { rfqId: reqPayload.rfqId },
        defaults: {
          ...reqPayload,
          projectId: project.id,
          createdBy: user.id,
        },
        transaction,
      });
    }
  }
};
