import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import sendmailPackage from 'sendmail';
import env from '../config/env.js';
import logger from '../config/logger.js';
import models from '../models/index.js';
import type { Contract } from '../models/contract.js';
import type { Requisition } from '../models/requisition.js';
import type { VendorCompany } from '../models/vendorCompany.js';
import type { Product } from '../models/product.js';
import type { EmailType, EmailStatus, EmailMetadata } from '../models/emailLog.js';

// Define sendmail types (since @types/sendmail doesn't export these properly)
interface SendmailOptions {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

type SendmailCallback = (err: Error | null, reply: any) => void;
type SendmailFunction = (options: SendmailOptions, callback: SendmailCallback) => void;

const { smtp, emailProvider, nodeEnv } = env;

// Log the email provider being used on startup
logger.info(`Email service initialized with provider: ${emailProvider}`, {
  provider: emailProvider,
  isDevelopment: nodeEnv === 'development',
  smtpHost: smtp.host || 'not configured',
  devPort: smtp.devPort,
});

/**
 * Build nodemailer transporter
 */
const buildNodemailerTransporter = (): Transporter => {
  if (!smtp.host || !smtp.user) {
    throw new Error('SMTP configuration missing for nodemailer');
  }
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port || 587,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });
};

/**
 * Build sendmail function
 */
const buildSendmailFunction = (): SendmailFunction => {
  const options: any = {
    silent: false,
    // In development, use devPort for local SMTP testing (MailHog/Mailpit)
    ...(nodeEnv === 'development' && smtp.devPort ? { devPort: smtp.devPort, devHost: 'localhost' } : {}),
  };

  return sendmailPackage(options) as SendmailFunction;
};

/**
 * Generate HTML email template for vendor attached
 */
const generateVendorAttachedEmailHTML = (
  vendorName: string,
  requisitionData: {
    title: string;
    projectName: string;
    dueDate?: Date;
    products: Array<{ name: string; quantity: number; targetPrice: number }>;
  },
  portalLink: string,
  chatbotLink?: string
): string => {
  const productsHTML = requisitionData.products
    .map(
      (p) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${p.name}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${p.quantity}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">$${p.targetPrice.toFixed(2)}</td>
    </tr>
  `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Requisition Assignment</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
        <h1 style="color: #0066cc; margin-top: 0;">New Requisition Assignment</h1>
        <p>Dear ${vendorName},</p>
        <p>You have been assigned to a new requisition:</p>

        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Requisition Details</h2>
          <p><strong>Project:</strong> ${requisitionData.projectName}</p>
          <p><strong>Title:</strong> ${requisitionData.title}</p>
          ${requisitionData.dueDate ? `<p><strong>Due Date:</strong> ${requisitionData.dueDate.toLocaleDateString()}</p>` : ''}

          <h3 style="color: #333; margin-top: 20px;">Products Required</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Product</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Quantity</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Target Price</th>
              </tr>
            </thead>
            <tbody>
              ${productsHTML}
            </tbody>
          </table>
        </div>

        <div style="margin: 30px 0;">
          <a href="${portalLink}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">View in Vendor Portal</a>
          ${chatbotLink ? `<a href="${chatbotLink}" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-left: 10px;">Start Negotiation</a>` : ''}
        </div>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Please review the requisition and respond at your earliest convenience.
        </p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate plain text email for vendor attached
 */
const generateVendorAttachedEmailText = (
  vendorName: string,
  requisitionData: {
    title: string;
    projectName: string;
    dueDate?: Date;
    products: Array<{ name: string; quantity: number; targetPrice: number }>;
  },
  portalLink: string,
  chatbotLink?: string
): string => {
  const productsText = requisitionData.products
    .map((p) => `  - ${p.name}: Qty ${p.quantity}, Target Price $${p.targetPrice.toFixed(2)}`)
    .join('\n');

  return `
New Requisition Assignment

Dear ${vendorName},

You have been assigned to a new requisition:

Requisition Details:
- Project: ${requisitionData.projectName}
- Title: ${requisitionData.title}
${requisitionData.dueDate ? `- Due Date: ${requisitionData.dueDate.toLocaleDateString()}` : ''}

Products Required:
${productsText}

View in Vendor Portal: ${portalLink}
${chatbotLink ? `Start Negotiation: ${chatbotLink}` : ''}

Please review the requisition and respond at your earliest convenience.
  `;
};

/**
 * Generate status change email HTML
 */
const generateStatusChangeEmailHTML = (
  vendorName: string,
  requisitionTitle: string,
  oldStatus: string,
  newStatus: string,
  portalLink: string
): string => {
  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      Created: '#6c757d',
      Opened: '#0066cc',
      Accepted: '#28a745',
      Rejected: '#dc3545',
      Expired: '#ffc107',
      Completed: '#17a2b8',
      Verified: '#20c997',
    };
    const color = colors[status] || '#6c757d';
    return `<span style="display: inline-block; padding: 4px 12px; background-color: ${color}; color: white; border-radius: 3px; font-size: 12px; font-weight: bold;">${status}</span>`;
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Contract Status Update</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
        <h1 style="color: #0066cc; margin-top: 0;">Contract Status Update</h1>
        <p>Dear ${vendorName},</p>
        <p>The status of your contract has been updated.</p>

        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Requisition:</strong> ${requisitionTitle}</p>
          <p><strong>Status Change:</strong></p>
          <div style="margin: 15px 0;">
            ${statusBadge(oldStatus)}
            <span style="margin: 0 10px;">→</span>
            ${statusBadge(newStatus)}
          </div>
        </div>

        <div style="margin: 30px 0;">
          <a href="${portalLink}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">View in Vendor Portal</a>
        </div>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Thank you for your continued partnership.
        </p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate status change email plain text
 */
const generateStatusChangeEmailText = (
  vendorName: string,
  requisitionTitle: string,
  oldStatus: string,
  newStatus: string,
  portalLink: string
): string => {
  return `
Contract Status Update

Dear ${vendorName},

The status of your contract has been updated.

Requisition: ${requisitionTitle}
Status Change: ${oldStatus} → ${newStatus}

View in Vendor Portal: ${portalLink}

Thank you for your continued partnership.
  `;
};

/**
 * Unified email options interface
 */
interface EmailAttachment {
  filename: string;
  content?: Buffer;
  path?: string;
  contentType?: string;
}

interface EmailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

/**
 * Send email using nodemailer
 */
const sendWithNodemailer = async (mailOptions: EmailOptions): Promise<{ messageId: string }> => {
  const transporter = buildNodemailerTransporter();
  const info = await transporter.sendMail(mailOptions);
  return { messageId: info.messageId };
};

/**
 * Send email using sendmail
 */
const sendWithSendmail = async (mailOptions: EmailOptions): Promise<{ messageId: string }> => {
  const sendmail = buildSendmailFunction();

  return new Promise((resolve, reject) => {
    const sendmailOptions: SendmailOptions = {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: mailOptions.html,
      text: mailOptions.text,
    };

    sendmail(sendmailOptions, (err: Error | null, reply: any) => {
      if (err) {
        reject(err);
      } else {
        // Sendmail doesn't return a messageId like nodemailer, generate one
        const messageId = `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@sendmail>`;
        resolve({ messageId });
      }
    });
  });
};

/**
 * Send email with retry logic (supports both providers)
 */
const sendEmailWithRetry = async (
  mailOptions: EmailOptions,
  maxRetries = 3
): Promise<{ messageId: string }> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let info: { messageId: string };

      if (emailProvider === 'sendmail') {
        info = await sendWithSendmail(mailOptions);
      } else {
        info = await sendWithNodemailer(mailOptions);
      }

      logger.info('Email sent successfully', {
        provider: emailProvider,
        to: mailOptions.to,
        subject: mailOptions.subject,
        messageId: info.messageId,
        attempt,
      });
      return info;
    } catch (error) {
      lastError = error as Error;
      logger.warn(`Email send attempt ${attempt} failed`, {
        provider: emailProvider,
        to: mailOptions.to,
        subject: mailOptions.subject,
        error: (error as Error).message,
      });
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw lastError;
};

/**
 * Log email to database
 */
const logEmail = async (
  recipientEmail: string,
  recipientId: number | null,
  subject: string,
  emailType: EmailType,
  status: EmailStatus,
  contractId?: number,
  requisitionId?: number,
  metadata?: EmailMetadata,
  errorMessage?: string,
  messageId?: string,
  retryCount = 0
): Promise<void> => {
  try {
    await models.EmailLog.create({
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
    });
  } catch (error) {
    logger.error('Failed to log email', { error: (error as Error).message });
  }
};

/**
 * Send vendor attached email
 * Note: Requires Contract to be loaded with vendor User association
 */
export const sendVendorAttachedEmail = async (
  contract: Contract & { Vendor?: any },
  requisition: Requisition & { Project?: any; Products?: any[] },
  chatbotDealId?: string
): Promise<void> => {
  try {
    const vendor = contract.Vendor;
    if (!vendor || !vendor.email) {
      throw new Error('Vendor email not available');
    }

    const vendorName = vendor.name || 'Vendor';
    const requisitionData = {
      title: (requisition as any).title || 'Untitled Requisition',
      projectName: requisition.Project?.name || 'Unknown Project',
      dueDate: (requisition as any).dueDate || undefined,
      products: (requisition.Products || []).map((p: any) => ({
        name: p.name || 'Unknown Product',
        quantity: p.quantity || 0,
        targetPrice: p.targetPrice || 0,
      })),
    };

    const portalLink = `${env.vendorPortalUrl}/contracts/${contract.uniqueToken}`;
    const chatbotLink = chatbotDealId
      ? `${env.chatbotFrontendUrl}/conversation/deals/${chatbotDealId}`
      : undefined;

    const mailOptions: EmailOptions = {
      from: smtp.from || 'noreply@accordo.ai',
      to: vendor.email,
      subject: `New Requisition Assignment: ${requisitionData.title}`,
      html: generateVendorAttachedEmailHTML(vendorName, requisitionData, portalLink, chatbotLink),
      text: generateVendorAttachedEmailText(vendorName, requisitionData, portalLink, chatbotLink),
    };

    const info = await sendEmailWithRetry(mailOptions);

    await logEmail(
      vendor.email,
      contract.vendorId || null,
      mailOptions.subject,
      'vendor_attached',
      'sent',
      contract.id,
      (requisition as any).id,
      {
        projectName: requisitionData.projectName,
        requisitionTitle: requisitionData.title,
        chatbotDealId,
      },
      undefined,
      info.messageId,
      0
    );
  } catch (error) {
    logger.error('Failed to send vendor attached email', {
      contractId: contract.id,
      vendorEmail: contract.Vendor?.email,
      error: (error as Error).message,
    });

    await logEmail(
      contract.Vendor?.email || 'unknown',
      contract.vendorId || null,
      `New Requisition Assignment: ${(requisition as any).title}`,
      'vendor_attached',
      'failed',
      contract.id,
      (requisition as any).id,
      {
        projectName: (requisition as any).Project?.name,
        requisitionTitle: (requisition as any).title,
      },
      (error as Error).message,
      undefined,
      2
    );

    throw error;
  }
};

/**
 * Send status change email
 * Note: Requires Contract to be loaded with vendor User association
 */
export const sendStatusChangeEmail = async (
  contract: Contract & { Vendor?: any },
  requisition: Requisition,
  oldStatus: string,
  newStatus: string
): Promise<void> => {
  try {
    const vendor = contract.Vendor;
    if (!vendor || !vendor.email) {
      throw new Error('Vendor email not available');
    }

    const vendorName = vendor.name || 'Vendor';
    const requisitionTitle = (requisition as any).title || 'Untitled Requisition';
    const portalLink = `${env.vendorPortalUrl}/contracts/${contract.uniqueToken}`;

    const mailOptions: EmailOptions = {
      from: smtp.from || 'noreply@accordo.ai',
      to: vendor.email,
      subject: `Contract Status Update: ${requisitionTitle}`,
      html: generateStatusChangeEmailHTML(vendorName, requisitionTitle, oldStatus, newStatus, portalLink),
      text: generateStatusChangeEmailText(vendorName, requisitionTitle, oldStatus, newStatus, portalLink),
    };

    const info = await sendEmailWithRetry(mailOptions);

    await logEmail(
      vendor.email,
      contract.vendorId || null,
      mailOptions.subject,
      'status_change',
      'sent',
      contract.id,
      (requisition as any).id,
      {
        oldStatus,
        newStatus,
        requisitionTitle,
      },
      undefined,
      info.messageId,
      0
    );
  } catch (error) {
    logger.error('Failed to send status change email', {
      contractId: contract.id,
      vendorEmail: contract.Vendor?.email,
      error: (error as Error).message,
    });

    await logEmail(
      contract.Vendor?.email || 'unknown',
      contract.vendorId || null,
      `Contract Status Update: ${(requisition as any).title}`,
      'status_change',
      'failed',
      contract.id,
      (requisition as any).id,
      {
        oldStatus,
        newStatus,
        requisitionTitle: (requisition as any).title,
      },
      (error as Error).message,
      undefined,
      2
    );

    throw error;
  }
};

/**
 * Email input options for object-based signature
 */
interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

/**
 * Generic send email function - exported for use by other modules
 * Supports both positional arguments and object-based input
 */
export async function sendEmail(options: SendEmailInput): Promise<{ messageId: string }>;
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
  attachments?: EmailAttachment[]
): Promise<{ messageId: string }>;
export async function sendEmail(
  toOrOptions: string | SendEmailInput,
  subject?: string,
  html?: string,
  text?: string,
  attachments?: EmailAttachment[]
): Promise<{ messageId: string }> {
  let mailOptions: EmailOptions;

  if (typeof toOrOptions === 'object') {
    // Object-based signature
    mailOptions = {
      from: smtp.from || 'noreply@accordo.ai',
      to: toOrOptions.to,
      subject: toOrOptions.subject,
      html: toOrOptions.html,
      text: toOrOptions.text || '',
      attachments: toOrOptions.attachments,
    };
  } else {
    // Positional arguments signature
    mailOptions = {
      from: smtp.from || 'noreply@accordo.ai',
      to: toOrOptions,
      subject: subject!,
      html: html!,
      text: text || '',
      attachments,
    };
  }

  return sendEmailWithRetry(mailOptions);
}

/**
 * Log email to database - exported for use by other modules
 */
export { logEmail };

// ==========================================
// APPROVAL EMAIL TEMPLATES AND FUNCTIONS
// ==========================================

/**
 * Generate approval pending email HTML
 */
const generateApprovalPendingEmailHTML = (
  approverName: string,
  requisitionData: {
    title: string;
    projectName: string;
    submittedBy: string;
    amount: number;
    approvalLevel: string;
    dueDate?: Date;
    priority: string;
  },
  approvalLink: string
): string => {
  const priorityColors: Record<string, string> = {
    LOW: '#6c757d',
    MEDIUM: '#0066cc',
    HIGH: '#ffc107',
    URGENT: '#dc3545',
  };
  const priorityColor = priorityColors[requisitionData.priority] || '#6c757d';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Approval Required</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
        <h1 style="color: #0066cc; margin-top: 0;">Approval Required - ${requisitionData.approvalLevel}</h1>
        <p>Dear ${approverName},</p>
        <p>A requisition requires your approval:</p>

        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Requisition Details</h2>
          <p><strong>Title:</strong> ${requisitionData.title}</p>
          <p><strong>Project:</strong> ${requisitionData.projectName}</p>
          <p><strong>Submitted By:</strong> ${requisitionData.submittedBy}</p>
          <p><strong>Amount:</strong> $${requisitionData.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p><strong>Approval Level:</strong> <span style="background-color: #0066cc; color: white; padding: 2px 8px; border-radius: 3px;">${requisitionData.approvalLevel}</span></p>
          <p><strong>Priority:</strong> <span style="background-color: ${priorityColor}; color: white; padding: 2px 8px; border-radius: 3px;">${requisitionData.priority}</span></p>
          ${requisitionData.dueDate ? `<p><strong>Due Date:</strong> ${requisitionData.dueDate.toLocaleDateString()}</p>` : ''}
        </div>

        <div style="margin: 30px 0; text-align: center;">
          <a href="${approvalLink}" style="display: inline-block; background-color: #28a745; color: white; padding: 14px 32px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Review & Approve</a>
        </div>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Please review the requisition and take action at your earliest convenience.
        </p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate approval pending email plain text
 */
const generateApprovalPendingEmailText = (
  approverName: string,
  requisitionData: {
    title: string;
    projectName: string;
    submittedBy: string;
    amount: number;
    approvalLevel: string;
    dueDate?: Date;
    priority: string;
  },
  approvalLink: string
): string => {
  return `
Approval Required - ${requisitionData.approvalLevel}

Dear ${approverName},

A requisition requires your approval:

Requisition Details:
- Title: ${requisitionData.title}
- Project: ${requisitionData.projectName}
- Submitted By: ${requisitionData.submittedBy}
- Amount: $${requisitionData.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Approval Level: ${requisitionData.approvalLevel}
- Priority: ${requisitionData.priority}
${requisitionData.dueDate ? `- Due Date: ${requisitionData.dueDate.toLocaleDateString()}` : ''}

Review & Approve: ${approvalLink}

Please review the requisition and take action at your earliest convenience.
  `;
};

/**
 * Generate approval approved email HTML
 */
const generateApprovalApprovedEmailHTML = (
  recipientName: string,
  requisitionData: {
    title: string;
    projectName: string;
    amount: number;
    approvalLevel: string;
    approvedBy: string;
    nextLevel?: string;
  },
  portalLink: string
): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Requisition Approved</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
        <h1 style="color: #28a745; margin-top: 0;">Requisition Approved - ${requisitionData.approvalLevel}</h1>
        <p>Dear ${recipientName},</p>
        <p>Good news! A requisition has been approved.</p>

        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Approval Details</h2>
          <p><strong>Title:</strong> ${requisitionData.title}</p>
          <p><strong>Project:</strong> ${requisitionData.projectName}</p>
          <p><strong>Amount:</strong> $${requisitionData.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p><strong>Approved By:</strong> ${requisitionData.approvedBy}</p>
          <p><strong>Approval Level:</strong> <span style="background-color: #28a745; color: white; padding: 2px 8px; border-radius: 3px;">${requisitionData.approvalLevel} APPROVED</span></p>
          ${requisitionData.nextLevel ? `<p><strong>Next Step:</strong> Pending ${requisitionData.nextLevel} Approval</p>` : '<p><strong>Status:</strong> <span style="background-color: #28a745; color: white; padding: 2px 8px; border-radius: 3px;">FULLY APPROVED</span></p>'}
        </div>

        <div style="margin: 30px 0;">
          <a href="${portalLink}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Requisition</a>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate approval approved email plain text
 */
const generateApprovalApprovedEmailText = (
  recipientName: string,
  requisitionData: {
    title: string;
    projectName: string;
    amount: number;
    approvalLevel: string;
    approvedBy: string;
    nextLevel?: string;
  },
  portalLink: string
): string => {
  return `
Requisition Approved - ${requisitionData.approvalLevel}

Dear ${recipientName},

Good news! A requisition has been approved.

Approval Details:
- Title: ${requisitionData.title}
- Project: ${requisitionData.projectName}
- Amount: $${requisitionData.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Approved By: ${requisitionData.approvedBy}
- Approval Level: ${requisitionData.approvalLevel} APPROVED
${requisitionData.nextLevel ? `- Next Step: Pending ${requisitionData.nextLevel} Approval` : '- Status: FULLY APPROVED'}

View Requisition: ${portalLink}
  `;
};

/**
 * Generate approval rejected email HTML
 */
const generateApprovalRejectedEmailHTML = (
  recipientName: string,
  requisitionData: {
    title: string;
    projectName: string;
    amount: number;
    approvalLevel: string;
    rejectedBy: string;
    reason: string;
  },
  portalLink: string
): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Requisition Rejected</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
        <h1 style="color: #dc3545; margin-top: 0;">Requisition Rejected</h1>
        <p>Dear ${recipientName},</p>
        <p>Unfortunately, a requisition has been rejected.</p>

        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Rejection Details</h2>
          <p><strong>Title:</strong> ${requisitionData.title}</p>
          <p><strong>Project:</strong> ${requisitionData.projectName}</p>
          <p><strong>Amount:</strong> $${requisitionData.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p><strong>Rejected By:</strong> ${requisitionData.rejectedBy}</p>
          <p><strong>Approval Level:</strong> <span style="background-color: #dc3545; color: white; padding: 2px 8px; border-radius: 3px;">${requisitionData.approvalLevel} REJECTED</span></p>

          <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 15px; margin-top: 15px;">
            <h3 style="color: #721c24; margin-top: 0;">Rejection Reason:</h3>
            <p style="color: #721c24; margin-bottom: 0;">${requisitionData.reason}</p>
          </div>
        </div>

        <div style="margin: 30px 0;">
          <a href="${portalLink}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Requisition</a>
        </div>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          You may revise and resubmit the requisition after addressing the concerns mentioned above.
        </p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate approval rejected email plain text
 */
const generateApprovalRejectedEmailText = (
  recipientName: string,
  requisitionData: {
    title: string;
    projectName: string;
    amount: number;
    approvalLevel: string;
    rejectedBy: string;
    reason: string;
  },
  portalLink: string
): string => {
  return `
Requisition Rejected

Dear ${recipientName},

Unfortunately, a requisition has been rejected.

Rejection Details:
- Title: ${requisitionData.title}
- Project: ${requisitionData.projectName}
- Amount: $${requisitionData.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Rejected By: ${requisitionData.rejectedBy}
- Approval Level: ${requisitionData.approvalLevel} REJECTED

Rejection Reason:
${requisitionData.reason}

View Requisition: ${portalLink}

You may revise and resubmit the requisition after addressing the concerns mentioned above.
  `;
};

/**
 * Send approval pending email to approver
 */
export const sendApprovalPendingEmail = async (
  approverEmail: string,
  approverName: string,
  approverId: number,
  requisitionData: {
    id: number;
    title: string;
    projectName: string;
    submittedBy: string;
    amount: number;
    approvalLevel: string;
    dueDate?: Date;
    priority: string;
  },
  approvalId: string
): Promise<void> => {
  try {
    const approvalLink = `${env.vendorPortalUrl}/approvals/${approvalId}`;

    const mailOptions: EmailOptions = {
      from: smtp.from || 'noreply@accordo.ai',
      to: approverEmail,
      subject: `[${requisitionData.priority}] Approval Required: ${requisitionData.title}`,
      html: generateApprovalPendingEmailHTML(approverName, requisitionData, approvalLink),
      text: generateApprovalPendingEmailText(approverName, requisitionData, approvalLink),
    };

    const info = await sendEmailWithRetry(mailOptions);

    await logEmail(
      approverEmail,
      approverId,
      mailOptions.subject,
      'other', // Using 'other' for approval emails
      'sent',
      undefined,
      requisitionData.id,
      {
        emailSubType: 'approval_pending',
        approvalLevel: requisitionData.approvalLevel,
        approvalId,
        amount: requisitionData.amount,
        priority: requisitionData.priority,
      },
      undefined,
      info.messageId,
      0
    );
  } catch (error) {
    logger.error('Failed to send approval pending email', {
      approverEmail,
      requisitionId: requisitionData.id,
      error: (error as Error).message,
    });
    throw error;
  }
};

/**
 * Send approval approved email
 */
export const sendApprovalApprovedEmail = async (
  recipientEmail: string,
  recipientName: string,
  recipientId: number,
  requisitionData: {
    id: number;
    title: string;
    projectName: string;
    amount: number;
    approvalLevel: string;
    approvedBy: string;
    nextLevel?: string;
  }
): Promise<void> => {
  try {
    const portalLink = `${env.vendorPortalUrl}/requisitions/${requisitionData.id}`;

    const mailOptions: EmailOptions = {
      from: smtp.from || 'noreply@accordo.ai',
      to: recipientEmail,
      subject: `Requisition Approved (${requisitionData.approvalLevel}): ${requisitionData.title}`,
      html: generateApprovalApprovedEmailHTML(recipientName, requisitionData, portalLink),
      text: generateApprovalApprovedEmailText(recipientName, requisitionData, portalLink),
    };

    const info = await sendEmailWithRetry(mailOptions);

    await logEmail(
      recipientEmail,
      recipientId,
      mailOptions.subject,
      'other',
      'sent',
      undefined,
      requisitionData.id,
      {
        emailSubType: 'approval_approved',
        approvalLevel: requisitionData.approvalLevel,
        approvedBy: requisitionData.approvedBy,
        nextLevel: requisitionData.nextLevel,
      },
      undefined,
      info.messageId,
      0
    );
  } catch (error) {
    logger.error('Failed to send approval approved email', {
      recipientEmail,
      requisitionId: requisitionData.id,
      error: (error as Error).message,
    });
    throw error;
  }
};

/**
 * Send approval rejected email
 */
export const sendApprovalRejectedEmail = async (
  recipientEmail: string,
  recipientName: string,
  recipientId: number,
  requisitionData: {
    id: number;
    title: string;
    projectName: string;
    amount: number;
    approvalLevel: string;
    rejectedBy: string;
    reason: string;
  }
): Promise<void> => {
  try {
    const portalLink = `${env.vendorPortalUrl}/requisitions/${requisitionData.id}`;

    const mailOptions: EmailOptions = {
      from: smtp.from || 'noreply@accordo.ai',
      to: recipientEmail,
      subject: `Requisition Rejected (${requisitionData.approvalLevel}): ${requisitionData.title}`,
      html: generateApprovalRejectedEmailHTML(recipientName, requisitionData, portalLink),
      text: generateApprovalRejectedEmailText(recipientName, requisitionData, portalLink),
    };

    const info = await sendEmailWithRetry(mailOptions);

    await logEmail(
      recipientEmail,
      recipientId,
      mailOptions.subject,
      'other',
      'sent',
      undefined,
      requisitionData.id,
      {
        emailSubType: 'approval_rejected',
        approvalLevel: requisitionData.approvalLevel,
        rejectedBy: requisitionData.rejectedBy,
        reason: requisitionData.reason,
      },
      undefined,
      info.messageId,
      0
    );
  } catch (error) {
    logger.error('Failed to send approval rejected email', {
      recipientEmail,
      requisitionId: requisitionData.id,
      error: (error as Error).message,
    });
    throw error;
  }
};
