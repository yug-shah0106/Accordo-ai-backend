import nodemailer from "nodemailer";
import env from "../config/env.js";
import logger from "../config/logger.js";
import CustomError from "../utils/custom-error.js";
import models from "../models/index.js";
import { vendorAttachedTemplate, statusChangeTemplate } from "./email-templates.js";

const { smtp } = env;

/**
 * Email Provider Abstraction Layer
 * Supports: SMTP (nodemailer), with easy extension for SendGrid, AWS SES, etc.
 */
class EmailProvider {
  constructor(config) {
    this.config = config;
    this.provider = config.provider || "smtp";
  }

  async send(mailOptions) {
    switch (this.provider) {
      case "smtp":
        return this.sendViaSMTP(mailOptions);
      // Future providers can be added here:
      // case "sendgrid":
      //   return this.sendViaSendGrid(mailOptions);
      // case "ses":
      //   return this.sendViaSES(mailOptions);
      default:
        return this.sendViaSMTP(mailOptions);
    }
  }

  async sendViaSMTP(mailOptions) {
    if (!this.config.host || !this.config.user) {
      throw new CustomError("SMTP configuration missing. Please set SMTP_HOST and SMTP_USER in environment.", 500);
    }

    const transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port || 587,
      secure: this.config.port === 465,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
    });

    return transporter.sendMail(mailOptions);
  }
}

// Initialize email provider
const emailProvider = new EmailProvider({
  provider: "smtp",
  host: smtp.host,
  port: smtp.port,
  user: smtp.user,
  pass: smtp.pass,
});

/**
 * Log email to database for audit trail
 */
const logEmail = async ({
  recipientEmail,
  recipientId,
  subject,
  emailType,
  status,
  contractId,
  requisitionId,
  metadata,
  errorMessage,
  messageId,
  retryCount = 0,
}) => {
  try {
    const emailLog = await models.EmailLog.create({
      recipientEmail,
      recipientId,
      subject,
      emailType,
      status,
      contractId,
      requisitionId,
      metadata,
      errorMessage,
      messageId,
      retryCount,
      sentAt: status === "sent" ? new Date() : null,
    });
    return emailLog;
  } catch (error) {
    logger.error(`Failed to log email: ${error.message}`);
    // Don't throw - logging failure shouldn't block email sending
    return null;
  }
};

/**
 * Update email log status
 */
const updateEmailLog = async (logId, updates) => {
  try {
    if (!logId) return;
    await models.EmailLog.update(updates, { where: { id: logId } });
  } catch (error) {
    logger.error(`Failed to update email log: ${error.message}`);
  }
};

/**
 * Generate unsubscribe URL
 */
const generateUnsubscribeUrl = (recipientId, token) => {
  if (!env.vendorPortalUrl || !recipientId) return null;
  // In production, this should be a signed URL with a token
  return `${env.vendorPortalUrl}/unsubscribe?userId=${recipientId}&token=${token}`;
};

/**
 * Send email with retry logic and logging
 * @param {Object} options - Email options
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @returns {Promise<Object>} - Send result
 * @throws {CustomError} - If all retries fail
 */
const sendWithRetry = async (options, maxRetries = 3) => {
  const {
    to,
    subject,
    html,
    text,
    emailType = "other",
    recipientId,
    contractId,
    requisitionId,
    metadata,
  } = options;

  // Create initial log entry
  const emailLog = await logEmail({
    recipientEmail: to,
    recipientId,
    subject,
    emailType,
    status: "pending",
    contractId,
    requisitionId,
    metadata,
    retryCount: 0,
  });

  const mailOptions = {
    from: smtp.from || "noreply@accordo.ai",
    to,
    subject,
    html,
    text,
  };

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Email send attempt ${attempt}/${maxRetries} to ${to}`);
      const result = await emailProvider.send(mailOptions);

      // Update log as successful
      await updateEmailLog(emailLog?.id, {
        status: "sent",
        sentAt: new Date(),
        messageId: result.messageId,
        retryCount: attempt - 1,
      });

      logger.info(`Email sent successfully to ${to}, messageId: ${result.messageId}`);
      return result;
    } catch (error) {
      lastError = error;
      logger.warn(`Email send attempt ${attempt} failed: ${error.message}`);

      // Update retry count
      await updateEmailLog(emailLog?.id, {
        retryCount: attempt,
        errorMessage: error.message,
      });

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  await updateEmailLog(emailLog?.id, {
    status: "failed",
    errorMessage: lastError.message,
  });

  logger.error(`Failed to send email after ${maxRetries} attempts`, {
    error: lastError.message,
    to,
  });

  throw new CustomError(
    `Failed to send email to vendor after ${maxRetries} attempts. Please check SMTP configuration and try again.`,
    500
  );
};

/**
 * Format product list for email
 */
const formatProductList = (products) => {
  if (!products || products.length === 0) {
    return [];
  }
  return products.map((p) => ({
    Product: p.Product,
    productName: p.Product?.name || p.productName,
    quantity: p.quantity,
    unit: p.unit || "units",
    targetPrice: p.targetPrice,
  }));
};

/**
 * Format date for display
 */
const formatDate = (date) => {
  if (!date) return "Not specified";
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * Send email when vendor is attached to requisition (contract created)
 * @param {Object} vendor - Vendor user object with email, name
 * @param {Object} requisition - Requisition with products, project
 * @param {Object} contract - Contract with uniqueToken
 * @param {string} dealId - Chatbot deal ID
 * @param {Object} options - Additional options (skipEmail, etc.)
 * @returns {Promise<Object>} - Send result or null if skipped
 */
export const sendVendorAttachedEmail = async (vendor, requisition, contract, dealId, options = {}) => {
  if (options.skipEmail) {
    logger.info(`Skipping email for vendor ${vendor.email} (skipEmail flag set)`);
    return null;
  }

  const vendorName = vendor.name || vendor.email;
  const requisitionTitle = requisition.title || requisition.name || "Untitled Requisition";
  const projectName = requisition.Project?.name || requisition.projectName || "N/A";
  const description = requisition.description || "No description provided";
  const dueDate = requisition.dueDate || requisition.benchmarkingDate;
  const products = formatProductList(requisition.RequisitionProducts || requisition.products || []);

  const vendorPortalUrl = `${env.vendorPortalUrl}?token=${contract.uniqueToken}`;
  const chatbotUrl = `${env.chatbotFrontendUrl}/conversation/deals/${dealId}`;
  const unsubscribeUrl = generateUnsubscribeUrl(vendor.id, contract.uniqueToken);

  const subject = `Invitation to Quote - ${requisitionTitle}`;

  // Generate HTML and text versions
  const { html, text } = vendorAttachedTemplate({
    vendorName,
    requisitionTitle,
    description,
    projectName,
    dueDate,
    products,
    vendorPortalUrl,
    chatbotUrl,
    unsubscribeUrl,
  });

  return sendWithRetry({
    to: vendor.email,
    subject,
    html,
    text,
    emailType: "vendor_attached",
    recipientId: vendor.id,
    contractId: contract.id,
    requisitionId: requisition.id,
    metadata: {
      dealId,
      projectName,
      requisitionTitle,
    },
  });
};

/**
 * Send email when contract status changes
 * @param {Object} vendor - Vendor user object
 * @param {Object} requisition - Requisition object
 * @param {Object} contract - Contract with uniqueToken, chatbotDealId
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Send result or null if skipped
 */
export const sendStatusChangeEmail = async (vendor, requisition, contract, oldStatus, newStatus, options = {}) => {
  if (options.skipEmail) {
    logger.info(`Skipping status change email for vendor ${vendor.email} (skipEmail flag set)`);
    return null;
  }

  const vendorName = vendor.name || vendor.email;
  const requisitionTitle = requisition?.title || requisition?.name || "Untitled Requisition";
  const projectName = requisition?.Project?.name || requisition?.projectName || "N/A";

  const vendorPortalUrl = `${env.vendorPortalUrl}?token=${contract.uniqueToken}`;
  const chatbotUrl = contract.chatbotDealId
    ? `${env.chatbotFrontendUrl}/conversation/deals/${contract.chatbotDealId}`
    : null;
  const unsubscribeUrl = generateUnsubscribeUrl(vendor.id, contract.uniqueToken);

  const subject = `Contract Update - ${requisitionTitle} [${newStatus}]`;

  // Generate HTML and text versions
  const { html, text } = statusChangeTemplate({
    vendorName,
    requisitionTitle,
    projectName,
    oldStatus,
    newStatus,
    vendorPortalUrl,
    chatbotUrl,
    unsubscribeUrl,
  });

  return sendWithRetry({
    to: vendor.email,
    subject,
    html,
    text,
    emailType: "status_change",
    recipientId: vendor.id,
    contractId: contract.id,
    requisitionId: requisition?.id,
    metadata: {
      oldStatus,
      newStatus,
      projectName,
      requisitionTitle,
    },
  });
};

/**
 * Get email logs for a contract
 */
export const getEmailLogsForContract = async (contractId) => {
  return models.EmailLog.findAll({
    where: { contractId },
    order: [["createdAt", "DESC"]],
  });
};

/**
 * Get email logs for a recipient
 */
export const getEmailLogsForRecipient = async (recipientEmail) => {
  return models.EmailLog.findAll({
    where: { recipientEmail },
    order: [["createdAt", "DESC"]],
    limit: 100,
  });
};

/**
 * Resend a failed email
 */
export const resendEmail = async (emailLogId) => {
  const emailLog = await models.EmailLog.findByPk(emailLogId);
  if (!emailLog) {
    throw new CustomError("Email log not found", 404);
  }
  if (emailLog.status === "sent") {
    throw new CustomError("Email was already sent successfully", 400);
  }

  // Fetch related data
  const contract = await models.Contract.findByPk(emailLog.contractId, {
    include: ["Vendor", "Requisition"],
  });

  if (!contract) {
    throw new CustomError("Related contract not found", 404);
  }

  // Re-trigger based on email type
  if (emailLog.emailType === "vendor_attached") {
    return sendVendorAttachedEmail(
      contract.Vendor,
      contract.Requisition,
      contract,
      contract.chatbotDealId
    );
  } else if (emailLog.emailType === "status_change") {
    const { oldStatus, newStatus } = emailLog.metadata || {};
    return sendStatusChangeEmail(
      contract.Vendor,
      contract.Requisition,
      contract,
      oldStatus,
      newStatus
    );
  }

  throw new CustomError("Unknown email type", 400);
};

export default {
  sendVendorAttachedEmail,
  sendStatusChangeEmail,
  sendWithRetry,
  getEmailLogsForContract,
  getEmailLogsForRecipient,
  resendEmail,
};
