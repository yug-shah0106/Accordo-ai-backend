import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import env from '../config/env.js';
import logger from '../config/logger.js';
import models from '../models/index.js';
import type { Contract } from '../models/contract.js';
import type { Requisition } from '../models/requisition.js';
import type { VendorCompany } from '../models/vendorCompany.js';
import type { Product } from '../models/product.js';
import type { EmailType, EmailStatus, EmailMetadata } from '../models/emailLog.js';

const { smtp } = env;

/**
 * Build nodemailer transporter
 */
const buildTransporter = (): Transporter => {
  if (!smtp.host || !smtp.user) {
    throw new Error('SMTP configuration missing');
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
 * Send email with retry logic
 */
const sendEmailWithRetry = async (
  mailOptions: nodemailer.SendMailOptions,
  maxRetries = 3
): Promise<nodemailer.SentMessageInfo> => {
  const transporter = buildTransporter();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      logger.info('Email sent successfully', {
        to: mailOptions.to,
        subject: mailOptions.subject,
        messageId: info.messageId,
        attempt,
      });
      return info;
    } catch (error) {
      lastError = error as Error;
      logger.warn(`Email send attempt ${attempt} failed`, {
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

    const mailOptions = {
      from: smtp.from,
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

    const mailOptions = {
      from: smtp.from,
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
