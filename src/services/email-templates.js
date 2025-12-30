/**
 * HTML Email Templates for Accordo
 * Professional, mobile-responsive email templates
 */

const baseStyles = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    margin: 0;
    padding: 0;
    background-color: #f5f5f5;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  .header {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    color: white;
    padding: 30px 40px;
    text-align: center;
  }
  .header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }
  .header .subtitle {
    margin-top: 8px;
    opacity: 0.9;
    font-size: 14px;
  }
  .content {
    padding: 40px;
  }
  .greeting {
    font-size: 18px;
    margin-bottom: 20px;
  }
  .section {
    margin: 25px 0;
    padding: 20px;
    background-color: #f8fafc;
    border-radius: 8px;
    border-left: 4px solid #2563eb;
  }
  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 15px;
  }
  .info-row {
    display: flex;
    margin: 10px 0;
  }
  .info-label {
    font-weight: 600;
    color: #475569;
    min-width: 120px;
  }
  .info-value {
    color: #1e293b;
  }
  .product-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
  }
  .product-table th {
    background-color: #e2e8f0;
    padding: 12px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
  }
  .product-table td {
    padding: 12px;
    border-bottom: 1px solid #e2e8f0;
    font-size: 14px;
  }
  .product-table tr:last-child td {
    border-bottom: none;
  }
  .cta-section {
    text-align: center;
    margin: 30px 0;
  }
  .cta-button {
    display: inline-block;
    padding: 14px 32px;
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    color: white !important;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 16px;
    margin: 8px;
  }
  .cta-button.secondary {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
  }
  .cta-button:hover {
    opacity: 0.9;
  }
  .status-badge {
    display: inline-block;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
  }
  .status-created { background-color: #dbeafe; color: #1d4ed8; }
  .status-opened { background-color: #fef3c7; color: #d97706; }
  .status-accepted { background-color: #d1fae5; color: #059669; }
  .status-rejected { background-color: #fee2e2; color: #dc2626; }
  .status-completed { background-color: #e0e7ff; color: #4f46e5; }
  .status-initialquotation { background-color: #f3e8ff; color: #7c3aed; }
  .footer {
    background-color: #f8fafc;
    padding: 30px 40px;
    text-align: center;
    border-top: 1px solid #e2e8f0;
  }
  .footer p {
    margin: 5px 0;
    color: #64748b;
    font-size: 13px;
  }
  .footer a {
    color: #2563eb;
    text-decoration: none;
  }
  .unsubscribe {
    margin-top: 15px;
    font-size: 12px;
    color: #94a3b8;
  }
  @media only screen and (max-width: 600px) {
    .content { padding: 20px; }
    .header { padding: 20px; }
    .cta-button { display: block; margin: 10px 0; }
  }
`;

/**
 * Format currency for display
 */
const formatCurrency = (amount) => {
  if (!amount) return "Not specified";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format date for display
 */
const formatDate = (date) => {
  if (!date) return "Not specified";
  return new Date(date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * Get status badge class
 */
const getStatusClass = (status) => {
  const statusMap = {
    Created: "status-created",
    Opened: "status-opened",
    Accepted: "status-accepted",
    Rejected: "status-rejected",
    Completed: "status-completed",
    InitialQuotation: "status-initialquotation",
    Verified: "status-completed",
  };
  return statusMap[status] || "status-created";
};

/**
 * Generate product table HTML
 */
const generateProductTable = (products) => {
  if (!products || products.length === 0) {
    return "<p>No products specified</p>";
  }

  const rows = products
    .map(
      (p, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${p.Product?.name || p.productName || "Unknown"}</td>
      <td>${p.quantity || "N/A"} ${p.unit || "units"}</td>
      <td>${formatCurrency(p.targetPrice)}</td>
    </tr>
  `
    )
    .join("");

  return `
    <table class="product-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Product</th>
          <th>Quantity</th>
          <th>Target Price</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

/**
 * Vendor Attached Email Template (Contract Created)
 */
export const vendorAttachedTemplate = ({
  vendorName,
  requisitionTitle,
  description,
  projectName,
  dueDate,
  products,
  vendorPortalUrl,
  chatbotUrl,
  unsubscribeUrl,
}) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to Quote - ${requisitionTitle}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div style="padding: 20px; background-color: #f5f5f5;">
    <div class="container">
      <div class="header">
        <h1>Accordo</h1>
        <div class="subtitle">AI-Powered Procurement Platform</div>
      </div>

      <div class="content">
        <div class="greeting">
          Hello <strong>${vendorName}</strong>,
        </div>

        <p>You have been invited to submit a quotation for the following requisition. Please review the details below and submit your competitive offer.</p>

        <div class="section">
          <div class="section-title">Requisition Details</div>
          <div class="info-row">
            <span class="info-label">Title:</span>
            <span class="info-value">${requisitionTitle}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Project:</span>
            <span class="info-value">${projectName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Description:</span>
            <span class="info-value">${description || "No description provided"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Due Date:</span>
            <span class="info-value"><strong>${formatDate(dueDate)}</strong></span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Products Requested</div>
          ${generateProductTable(products)}
        </div>

        <div class="cta-section">
          <p style="color: #64748b; margin-bottom: 20px;">Access your portals to submit your quotation:</p>
          <a href="${vendorPortalUrl}" class="cta-button">Open Vendor Portal</a>
          <a href="${chatbotUrl}" class="cta-button secondary">AI Negotiation Assistant</a>
        </div>

        <p style="color: #64748b; font-size: 14px; text-align: center;">
          Please submit your quotation before <strong>${formatDate(dueDate)}</strong>
        </p>
      </div>

      <div class="footer">
        <p><strong>Accordo Procurement Team</strong></p>
        <p>This is an automated notification from Accordo.</p>
        ${unsubscribeUrl ? `<p class="unsubscribe"><a href="${unsubscribeUrl}">Unsubscribe</a> from these notifications</p>` : ""}
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hello ${vendorName},

You have been invited to submit a quotation for the following requisition.

REQUISITION DETAILS
-------------------
Title: ${requisitionTitle}
Project: ${projectName}
Description: ${description || "No description provided"}
Due Date: ${formatDate(dueDate)}

PRODUCTS REQUESTED
------------------
${products?.map((p, i) => `${i + 1}. ${p.Product?.name || p.productName} - Qty: ${p.quantity} ${p.unit || "units"} | Target: ${formatCurrency(p.targetPrice)}`).join("\n") || "No products specified"}

ACCESS YOUR PORTALS
-------------------
Vendor Portal: ${vendorPortalUrl}
AI Negotiation Assistant: ${chatbotUrl}

Please submit your quotation before ${formatDate(dueDate)}.

Regards,
Accordo Procurement Team
  `;

  return { html, text };
};

/**
 * Status Change Email Template
 */
export const statusChangeTemplate = ({
  vendorName,
  requisitionTitle,
  projectName,
  oldStatus,
  newStatus,
  vendorPortalUrl,
  chatbotUrl,
  unsubscribeUrl,
}) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contract Update - ${requisitionTitle}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div style="padding: 20px; background-color: #f5f5f5;">
    <div class="container">
      <div class="header">
        <h1>Accordo</h1>
        <div class="subtitle">Contract Status Update</div>
      </div>

      <div class="content">
        <div class="greeting">
          Hello <strong>${vendorName}</strong>,
        </div>

        <p>Your contract status has been updated. Please see the details below.</p>

        <div class="section">
          <div class="section-title">Status Update</div>
          <div style="text-align: center; padding: 20px 0;">
            <span class="status-badge ${getStatusClass(oldStatus)}">${oldStatus}</span>
            <span style="margin: 0 15px; color: #64748b;">→</span>
            <span class="status-badge ${getStatusClass(newStatus)}">${newStatus}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Requisition Details</div>
          <div class="info-row">
            <span class="info-label">Title:</span>
            <span class="info-value">${requisitionTitle}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Project:</span>
            <span class="info-value">${projectName}</span>
          </div>
        </div>

        <div class="cta-section">
          <a href="${vendorPortalUrl}" class="cta-button">View in Portal</a>
          ${chatbotUrl ? `<a href="${chatbotUrl}" class="cta-button secondary">AI Assistant</a>` : ""}
        </div>
      </div>

      <div class="footer">
        <p><strong>Accordo Procurement Team</strong></p>
        <p>This is an automated notification from Accordo.</p>
        ${unsubscribeUrl ? `<p class="unsubscribe"><a href="${unsubscribeUrl}">Unsubscribe</a> from these notifications</p>` : ""}
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hello ${vendorName},

Your contract status has been updated.

STATUS UPDATE
-------------
Previous Status: ${oldStatus}
New Status: ${newStatus}

REQUISITION DETAILS
-------------------
Title: ${requisitionTitle}
Project: ${projectName}

ACCESS YOUR PORTAL
------------------
Vendor Portal: ${vendorPortalUrl}
${chatbotUrl ? `AI Negotiation Assistant: ${chatbotUrl}` : ""}

Regards,
Accordo Procurement Team
  `;

  return { html, text };
};

export default {
  vendorAttachedTemplate,
  statusChangeTemplate,
};
