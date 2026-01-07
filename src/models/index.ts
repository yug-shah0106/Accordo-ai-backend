import { Sequelize, Model } from 'sequelize';
import sequelize from '../config/database.js';

import authTokenModel, { AuthToken } from './authToken.js';
import companyModel, { Company } from './company.js';
import contractModel, { Contract } from './contract.js';
import moduleModel, { Module } from './module.js';
import otpModel, { Otp } from './otp.js';
import poModel, { Po } from './po.js';
import productModel, { Product } from './product.js';
import projectModel, { Project } from './project.js';
import projectPocModel, { ProjectPoc } from './projectPoc.js';
import requisitionModel, { Requisition } from './requisition.js';
import requisitionAttachmentModel, { RequisitionAttachment } from './requisitionAttachment.js';
import requisitionProductModel, { RequisitionProduct } from './requisitionProduct.js';
import roleModel, { Role } from './role.js';
import rolePermissionModel, { RolePermission } from './rolePermission.js';
import userModel, { User } from './user.js';
import userActionModel, { UserAction } from './userAction.js';
import vendorCompanyModel, { VendorCompany } from './vendorCompany.js';
import negotiationModel, { Negotiation } from './negotiation.js';
import negotiationRoundModel, { NegotiationRound } from './negotiationRound.js';
import preferenceModel, { Preference } from './preference.js';
import chatSessionModel, { ChatSession } from './chatSession.js';
import emailLogModel, { EmailLog } from './emailLog.js';
import { initChatbotTemplateModel, ChatbotTemplate } from './chatbotTemplate.js';
import { initChatbotTemplateParameterModel, ChatbotTemplateParameter } from './chatbotTemplateParameter.js';
import { initChatbotDealModel, ChatbotDeal } from './chatbotDeal.js';
import { initChatbotMessageModel, ChatbotMessage } from './chatbotMessage.js';
import { initNegotiationTrainingDataModel, NegotiationTrainingData } from './negotiationTrainingData.js';

// Type definitions for the models collection
export interface Models {
  User: typeof User;
  Otp: typeof Otp;
  Po: typeof Po;
  Role: typeof Role;
  UserAction: typeof UserAction;
  RolePermission: typeof RolePermission;
  Module: typeof Module;
  AuthToken: typeof AuthToken;
  Product: typeof Product;
  Company: typeof Company;
  Project: typeof Project;
  ProjectPoc: typeof ProjectPoc;
  Requisition: typeof Requisition;
  RequisitionProduct: typeof RequisitionProduct;
  RequisitionAttachment: typeof RequisitionAttachment;
  Contract: typeof Contract;
  VendorCompany: typeof VendorCompany;
  Negotiation: typeof Negotiation;
  NegotiationRound: typeof NegotiationRound;
  Preference: typeof Preference;
  ChatSession: typeof ChatSession;
  EmailLog: typeof EmailLog;
  ChatbotTemplate: typeof ChatbotTemplate;
  ChatbotTemplateParameter: typeof ChatbotTemplateParameter;
  ChatbotDeal: typeof ChatbotDeal;
  ChatbotMessage: typeof ChatbotMessage;
  NegotiationTrainingData: typeof NegotiationTrainingData;
  // Legacy aliases
  Vendor: typeof User;
  vendorCompany: typeof VendorCompany;
}

// Initialize all models
const models: Models = {
  User: userModel(sequelize),
  Otp: otpModel(sequelize),
  Po: poModel(sequelize),
  Role: roleModel(sequelize),
  UserAction: userActionModel(sequelize),
  RolePermission: rolePermissionModel(sequelize),
  Module: moduleModel(sequelize),
  AuthToken: authTokenModel(sequelize),
  Product: productModel(sequelize),
  Company: companyModel(sequelize),
  Project: projectModel(sequelize),
  ProjectPoc: projectPocModel(sequelize),
  Requisition: requisitionModel(sequelize),
  RequisitionProduct: requisitionProductModel(sequelize),
  RequisitionAttachment: requisitionAttachmentModel(sequelize),
  Contract: contractModel(sequelize),
  VendorCompany: vendorCompanyModel(sequelize),
  Negotiation: negotiationModel(sequelize),
  NegotiationRound: negotiationRoundModel(sequelize),
  Preference: preferenceModel(sequelize),
  ChatSession: chatSessionModel(sequelize),
  EmailLog: emailLogModel(sequelize),
  ChatbotTemplate: initChatbotTemplateModel(sequelize),
  ChatbotTemplateParameter: initChatbotTemplateParameterModel(sequelize),
  ChatbotDeal: initChatbotDealModel(sequelize),
  ChatbotMessage: initChatbotMessageModel(sequelize),
  NegotiationTrainingData: initNegotiationTrainingDataModel(sequelize),
  // Maintain legacy aliases
  Vendor: null as unknown as typeof User,
  vendorCompany: null as unknown as typeof VendorCompany,
};

// Set legacy aliases
models.Vendor = models.User;
models.vendorCompany = models.VendorCompany;

// Run associations
const uniqueModels = new Set(Object.values(models));
uniqueModels.forEach((model) => {
  if (model && typeof (model as typeof Model & { associate?: (models: Record<string, typeof Model>) => void }).associate === 'function') {
    (model as typeof Model & { associate: (models: Record<string, typeof Model>) => void }).associate(models as unknown as Record<string, typeof Model>);
  }
});

// Export individual models for direct import
export {
  User,
  Otp,
  Po,
  Role,
  UserAction,
  RolePermission,
  Module,
  AuthToken,
  Product,
  Company,
  Project,
  ProjectPoc,
  Requisition,
  RequisitionProduct,
  RequisitionAttachment,
  Contract,
  VendorCompany,
  Negotiation,
  NegotiationRound,
  Preference,
  ChatSession,
  EmailLog,
  ChatbotTemplate,
  ChatbotTemplateParameter,
  ChatbotDeal,
  ChatbotMessage,
  NegotiationTrainingData,
  sequelize,
};

export default models;
