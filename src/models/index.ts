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
import { initMessageEmbeddingModel, MessageEmbedding } from './messageEmbedding.js';
import { initDealEmbeddingModel, DealEmbedding } from './dealEmbedding.js';
import { initNegotiationPatternModel, NegotiationPattern } from './negotiationPattern.js';
import { initVectorMigrationStatusModel, VectorMigrationStatus } from './vectorMigrationStatus.js';
import vendorBidModel, { VendorBid } from './vendorBid.js';
import bidComparisonModel, { BidComparison } from './bidComparison.js';
import vendorSelectionModel, { VendorSelection } from './vendorSelection.js';
import vendorNotificationModel, { VendorNotification } from './vendorNotification.js';
import { initApprovalModel, Approval } from './approval.js';
import addressModel, { Address } from './address.js';

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
  MessageEmbedding: typeof MessageEmbedding;
  DealEmbedding: typeof DealEmbedding;
  NegotiationPattern: typeof NegotiationPattern;
  VectorMigrationStatus: typeof VectorMigrationStatus;
  VendorBid: typeof VendorBid;
  BidComparison: typeof BidComparison;
  VendorSelection: typeof VendorSelection;
  VendorNotification: typeof VendorNotification;
  Approval: typeof Approval;
  Address: typeof Address;
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
  MessageEmbedding: initMessageEmbeddingModel(sequelize),
  DealEmbedding: initDealEmbeddingModel(sequelize),
  NegotiationPattern: initNegotiationPatternModel(sequelize),
  VectorMigrationStatus: initVectorMigrationStatusModel(sequelize),
  VendorBid: vendorBidModel(sequelize),
  BidComparison: bidComparisonModel(sequelize),
  VendorSelection: vendorSelectionModel(sequelize),
  VendorNotification: vendorNotificationModel(sequelize),
  Approval: initApprovalModel(sequelize),
  Address: addressModel(sequelize),
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
  MessageEmbedding,
  DealEmbedding,
  NegotiationPattern,
  VectorMigrationStatus,
  VendorBid,
  BidComparison,
  VendorSelection,
  VendorNotification,
  Approval,
  Address,
  sequelize,
};

export default models;
