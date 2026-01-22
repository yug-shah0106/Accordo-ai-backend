import type { Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import {
  getRequisitionsForBidAnalysis,
  getRequisitionBidDetail,
  getActionHistory,
  rejectBid,
  restoreBid,
  selectBidForAnalysis,
  logViewAction,
  logExportAction,
} from './bidAnalysis.service.js';
import {
  getRequisitionsSchema,
  requisitionIdParamSchema,
  bidIdParamSchema,
  selectBidBodySchema,
  rejectBidBodySchema,
} from './bidAnalysis.validator.js';
import { CustomError } from '../../utils/custom-error.js';
import type { TopBidInfo } from './bidAnalysis.types.js';

/**
 * GET /api/bid-analysis/requisitions
 * List requisitions with bid summaries
 */
export async function getRequisitions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { error, value } = getRequisitionsSchema.validate(req.query);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const userId = req.context?.userId;
    const companyId = req.context?.companyId || null;

    if (!userId) {
      throw new CustomError('Authentication required', 401);
    }

    const result = await getRequisitionsForBidAnalysis(userId, companyId, value);

    res.json({
      message: 'Requisitions retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/bid-analysis/requisitions/:requisitionId
 * Get detailed bid analysis for a requisition
 */
export async function getRequisitionDetail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { error, value } = requisitionIdParamSchema.validate(req.params);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const userId = req.context?.userId;
    if (!userId) {
      throw new CustomError('Authentication required', 401);
    }

    const result = await getRequisitionBidDetail(value.requisitionId);

    // Log view action
    await logViewAction(value.requisitionId, userId);

    res.json({
      message: 'Requisition detail retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/bid-analysis/requisitions/:requisitionId/history
 * Get action history for a requisition
 */
export async function getHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { error, value } = requisitionIdParamSchema.validate(req.params);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const result = await getActionHistory(value.requisitionId);

    res.json({
      message: 'History retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/bid-analysis/requisitions/:requisitionId/select/:bidId
 * Select a bid (award to vendor)
 */
export async function selectBid(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { error: paramsError, value: params } = bidIdParamSchema.validate(req.params);
    if (paramsError) {
      throw new CustomError(paramsError.details[0].message, 400);
    }

    const { error: bodyError, value: body } = selectBidBodySchema.validate(req.body);
    if (bodyError) {
      throw new CustomError(bodyError.details[0].message, 400);
    }

    const userId = req.context?.userId;
    if (!userId) {
      throw new CustomError('Authentication required', 401);
    }

    const result = await selectBidForAnalysis(
      params.requisitionId,
      params.bidId,
      userId,
      body.remarks
    );

    res.json({
      message: 'Vendor selected successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/bid-analysis/requisitions/:requisitionId/reject/:bidId
 * Reject a bid
 */
export async function rejectBidHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { error: paramsError, value: params } = bidIdParamSchema.validate(req.params);
    if (paramsError) {
      throw new CustomError(paramsError.details[0].message, 400);
    }

    const { error: bodyError, value: body } = rejectBidBodySchema.validate(req.body);
    if (bodyError) {
      throw new CustomError(bodyError.details[0].message, 400);
    }

    const userId = req.context?.userId;
    if (!userId) {
      throw new CustomError('Authentication required', 401);
    }

    const result = await rejectBid(
      params.requisitionId,
      params.bidId,
      userId,
      body.remarks
    );

    res.json({
      message: 'Bid rejected successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/bid-analysis/requisitions/:requisitionId/restore/:bidId
 * Restore a rejected bid
 */
export async function restoreBidHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { error, value } = bidIdParamSchema.validate(req.params);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const userId = req.context?.userId;
    if (!userId) {
      throw new CustomError('Authentication required', 401);
    }

    const result = await restoreBid(
      value.requisitionId,
      value.bidId,
      userId
    );

    res.json({
      message: 'Bid restored successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/bid-analysis/requisitions/:requisitionId/export
 * Log export action (PDF download happens client-side via existing endpoint)
 */
export async function exportPdfHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { error, value } = requisitionIdParamSchema.validate(req.params);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const userId = req.context?.userId;
    if (!userId) {
      throw new CustomError('Authentication required', 401);
    }

    await logExportAction(value.requisitionId, userId);

    res.json({
      message: 'Export logged successfully',
      data: { success: true },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/bid-analysis/requisitions/:requisitionId/pdf
 * Generate and download PDF on-the-fly with enhanced layout
 */
export async function downloadPdfHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { error, value } = requisitionIdParamSchema.validate(req.params);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const userId = req.context?.userId;
    if (!userId) {
      throw new CustomError('Authentication required', 401);
    }

    // Get requisition data
    const detail = await getRequisitionBidDetail(value.requisitionId);

    // Log export action
    await logExportAction(value.requisitionId, userId);

    // Generate PDF in landscape orientation for better table display
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40,
      info: {
        Title: `Bid Comparison - ${detail.requisition.rfqId}`,
        Author: 'Accordo AI',
        Subject: 'Vendor Bid Comparison Report',
      },
    });

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bid-comparison-${detail.requisition.rfqId}.pdf"`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Brand colors
    const colors = {
      primary: '#1a56db',      // Accordo blue
      primaryLight: '#3b82f6',
      primaryDark: '#1e40af',
      success: '#059669',
      successLight: '#10b981',
      warning: '#d97706',
      warningLight: '#f59e0b',
      danger: '#dc2626',
      text: '#1f2937',
      textLight: '#6b7280',
      border: '#e5e7eb',
      background: '#f9fafb',
      white: '#ffffff',
    };

    const pageWidth = 841.89; // A4 landscape width
    const pageHeight = 595.28; // A4 landscape height
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);

    // Helper functions
    const drawHeader = () => {
      // Header bar with gradient effect
      doc.rect(0, 0, pageWidth, 70).fill(colors.primary);
      doc.rect(0, 65, pageWidth, 5).fill(colors.primaryLight);

      // Company branding
      doc.fontSize(24).fillColor(colors.white).text('ACCORDO', margin, 20, { continued: true });
      doc.fontSize(10).fillColor(colors.primaryLight).text(' AI', { continued: false });

      // Report title
      doc.fontSize(16).fillColor(colors.white).text('Bid Comparison Report', margin, 45);

      // RFQ info on right
      doc.fontSize(10).fillColor(colors.white);
      doc.text(`RFQ: ${detail.requisition.rfqId}`, pageWidth - margin - 150, 25, { width: 150, align: 'right' });
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin - 150, 40, { width: 150, align: 'right' });
    };

    const drawFooter = (pageNum: number, totalPages: number) => {
      const footerY = pageHeight - 30;
      doc.fontSize(8).fillColor(colors.textLight);
      doc.text('Confidential - For Internal Use Only', margin, footerY, { width: contentWidth / 2 });
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 100, footerY, { width: 100, align: 'right' });
      doc.text('Powered by Accordo AI', pageWidth / 2 - 50, footerY, { width: 100, align: 'center' });
    };

    const drawSectionHeader = (title: string, y: number) => {
      doc.rect(margin, y, contentWidth, 28).fill(colors.background);
      doc.rect(margin, y, 4, 28).fill(colors.primary);
      doc.fontSize(12).fillColor(colors.primary).text(title.toUpperCase(), margin + 15, y + 8);
      return y + 35;
    };

    // ==================== PAGE 1: Executive Summary ====================
    drawHeader();
    let currentY = 85;

    // Requisition Info Section
    currentY = drawSectionHeader('Requisition Details', currentY);

    // Info cards in a row
    const cardWidth = (contentWidth - 30) / 4;
    const cardHeight = 60;

    const drawInfoCard = (x: number, y: number, label: string, value: string, accent: string) => {
      doc.rect(x, y, cardWidth, cardHeight).fill(colors.white);
      doc.rect(x, y, cardWidth, cardHeight).stroke(colors.border);
      doc.rect(x, y, cardWidth, 4).fill(accent);
      doc.fontSize(9).fillColor(colors.textLight).text(label, x + 10, y + 12);
      doc.fontSize(11).fillColor(colors.text).text(value || 'N/A', x + 10, y + 28, { width: cardWidth - 20, ellipsis: true });
    };

    drawInfoCard(margin, currentY, 'Subject', detail.requisition.subject, colors.primary);
    drawInfoCard(margin + cardWidth + 10, currentY, 'Project', detail.requisition.projectName || 'N/A', colors.primary);
    drawInfoCard(margin + (cardWidth + 10) * 2, currentY, 'Category', detail.requisition.category || 'N/A', colors.primary);
    drawInfoCard(margin + (cardWidth + 10) * 3, currentY, 'Deadline', detail.requisition.negotiationClosureDate ? new Date(detail.requisition.negotiationClosureDate).toLocaleDateString() : 'N/A', colors.warning);

    currentY += cardHeight + 20;

    // Statistics Section
    currentY = drawSectionHeader('Bid Statistics', currentY);

    // Stat boxes
    const statBoxWidth = (contentWidth - 40) / 5;
    const statBoxHeight = 70;

    const drawStatBox = (x: number, y: number, label: string, value: string, subtext: string, color: string) => {
      doc.rect(x, y, statBoxWidth, statBoxHeight).fill(colors.white);
      doc.rect(x, y, statBoxWidth, statBoxHeight).stroke(colors.border);
      doc.fontSize(24).fillColor(color).text(value, x, y + 12, { width: statBoxWidth, align: 'center' });
      doc.fontSize(9).fillColor(colors.text).text(label, x, y + 42, { width: statBoxWidth, align: 'center' });
      if (subtext) {
        doc.fontSize(8).fillColor(colors.textLight).text(subtext, x, y + 54, { width: statBoxWidth, align: 'center' });
      }
    };

    drawStatBox(margin, currentY, 'Total Vendors', String(detail.requisition.totalVendors), '', colors.primary);
    drawStatBox(margin + statBoxWidth + 10, currentY, 'Completed', String(detail.requisition.completedVendors), `${Math.round((detail.requisition.completedVendors / detail.requisition.totalVendors) * 100) || 0}%`, colors.success);
    drawStatBox(margin + (statBoxWidth + 10) * 2, currentY, 'Lowest Bid', detail.priceRange.lowest ? `$${detail.priceRange.lowest.toLocaleString()}` : 'N/A', '', colors.successLight);
    drawStatBox(margin + (statBoxWidth + 10) * 3, currentY, 'Highest Bid', detail.priceRange.highest ? `$${detail.priceRange.highest.toLocaleString()}` : 'N/A', '', colors.warning);
    drawStatBox(margin + (statBoxWidth + 10) * 4, currentY, 'Average', detail.priceRange.average ? `$${Math.round(detail.priceRange.average).toLocaleString()}` : 'N/A', '', colors.textLight);

    currentY += statBoxHeight + 20;

    // Target Price Info
    if (detail.priceRange.targetPrice || detail.priceRange.maxAcceptablePrice) {
      doc.rect(margin, currentY, contentWidth, 35).fill('#eff6ff');
      doc.rect(margin, currentY, contentWidth, 35).stroke('#bfdbfe');
      doc.fontSize(10).fillColor(colors.primary);
      let priceText = '';
      if (detail.priceRange.targetPrice) {
        priceText += `Target Price: $${detail.priceRange.targetPrice.toLocaleString()}`;
      }
      if (detail.priceRange.maxAcceptablePrice) {
        priceText += priceText ? '   |   ' : '';
        priceText += `Max Acceptable: $${detail.priceRange.maxAcceptablePrice.toLocaleString()}`;
      }
      doc.text(priceText, margin + 15, currentY + 12);
      currentY += 45;
    }

    // Top 3 Bids Section
    currentY = drawSectionHeader('Top Ranked Bids (L1, L2, L3)', currentY);

    const topBidWidth = (contentWidth - 20) / 3;
    const topBidHeight = 120;

    detail.topBids.slice(0, 3).forEach((bid: TopBidInfo, index: number) => {
      const x = margin + (topBidWidth + 10) * index;
      const rankColors = [colors.success, colors.primaryLight, colors.warning];
      const rankLabels = ['L1 - BEST', 'L2', 'L3'];
      const rankColor = rankColors[index] || colors.textLight;

      // Card background
      doc.rect(x, currentY, topBidWidth, topBidHeight).fill(colors.white);
      doc.rect(x, currentY, topBidWidth, topBidHeight).stroke(colors.border);

      // Rank badge
      doc.rect(x, currentY, topBidWidth, 25).fill(rankColor);
      doc.fontSize(10).fillColor(colors.white).text(rankLabels[index], x + 10, currentY + 7);

      // Rejected badge if applicable
      if (bid.isRejected) {
        doc.rect(x + topBidWidth - 60, currentY + 4, 50, 17).fill(colors.danger);
        doc.fontSize(8).fillColor(colors.white).text('REJECTED', x + topBidWidth - 55, currentY + 8);
      }

      // Vendor info
      doc.fontSize(11).fillColor(colors.text).text(bid.vendorName, x + 10, currentY + 35, { width: topBidWidth - 20, ellipsis: true });
      doc.fontSize(9).fillColor(colors.textLight).text(bid.vendorEmail, x + 10, currentY + 50, { width: topBidWidth - 20, ellipsis: true });

      // Price (prominent)
      doc.fontSize(18).fillColor(rankColor).text(`$${bid.finalPrice?.toLocaleString() || 'N/A'}`, x + 10, currentY + 70);

      // Details
      doc.fontSize(8).fillColor(colors.textLight);
      doc.text(`Terms: ${bid.paymentTerms || 'N/A'}`, x + 10, currentY + 95);
      doc.text(`Utility: ${bid.utilityScore ? `${(bid.utilityScore * 100).toFixed(1)}%` : 'N/A'}`, x + topBidWidth / 2, currentY + 95);
    });

    currentY += topBidHeight + 10;
    drawFooter(1, detail.selectedBidId ? 3 : 2);

    // ==================== PAGE 2: All Bids Comparison Table ====================
    doc.addPage();
    drawHeader();
    currentY = 85;

    currentY = drawSectionHeader('Complete Bid Comparison', currentY);

    // Table
    const tableHeaders = ['Rank', 'Vendor Name', 'Email', 'Price', 'Payment Terms', 'Delivery', 'Utility', 'Status'];
    const colWidths = [45, 130, 160, 90, 100, 85, 70, 80];
    const rowHeight = 28;

    // Table header
    doc.rect(margin, currentY, contentWidth, rowHeight).fill(colors.primary);
    let x = margin + 5;
    doc.fontSize(9).fillColor(colors.white);
    tableHeaders.forEach((header, i) => {
      doc.text(header, x, currentY + 9, { width: colWidths[i] - 10 });
      x += colWidths[i];
    });
    currentY += rowHeight;

    // Table rows
    detail.allBids.forEach((bid, index) => {
      if (currentY > pageHeight - 60) {
        drawFooter(2, detail.selectedBidId ? 3 : 2);
        doc.addPage();
        drawHeader();
        currentY = 85;
        // Redraw header
        doc.rect(margin, currentY, contentWidth, rowHeight).fill(colors.primary);
        x = margin + 5;
        doc.fontSize(9).fillColor(colors.white);
        tableHeaders.forEach((header, i) => {
          doc.text(header, x, currentY + 9, { width: colWidths[i] - 10 });
          x += colWidths[i];
        });
        currentY += rowHeight;
      }

      const isSelected = bid.bidId === detail.selectedBidId;
      const bgColor = isSelected ? '#dcfce7' : (index % 2 === 0 ? colors.white : colors.background);

      doc.rect(margin, currentY, contentWidth, rowHeight).fill(bgColor);
      doc.rect(margin, currentY, contentWidth, rowHeight).stroke(colors.border);

      if (isSelected) {
        doc.rect(margin, currentY, 4, rowHeight).fill(colors.success);
      }

      x = margin + 5;
      doc.fontSize(9).fillColor(bid.isRejected ? colors.textLight : colors.text);

      const statusText = isSelected ? 'SELECTED' : (bid.isRejected ? 'Rejected' : (bid.dealStatus || 'Pending'));
      const statusColor = isSelected ? colors.success : (bid.isRejected ? colors.danger : colors.text);

      const rowData = [
        `#${bid.rank}`,
        bid.vendorName,
        bid.vendorEmail,
        bid.finalPrice ? `$${bid.finalPrice.toLocaleString()}` : 'N/A',
        bid.paymentTerms || 'N/A',
        bid.deliveryDate ? new Date(bid.deliveryDate).toLocaleDateString() : 'N/A',
        bid.utilityScore ? `${(bid.utilityScore * 100).toFixed(1)}%` : 'N/A',
        statusText,
      ];

      rowData.forEach((cell, i) => {
        if (i === rowData.length - 1) {
          doc.fillColor(statusColor);
        }
        doc.text(cell, x, currentY + 9, { width: colWidths[i] - 10, ellipsis: true });
        x += colWidths[i];
      });

      currentY += rowHeight;
    });

    drawFooter(2, detail.selectedBidId ? 3 : 2);

    // ==================== PAGE 3: Selected Vendor Details (if awarded) ====================
    if (detail.selectedBidId && detail.selectedVendorId) {
      doc.addPage();
      drawHeader();
      currentY = 85;

      // Find selected bid details
      const selectedBid = detail.allBids.find(b => b.bidId === detail.selectedBidId);

      currentY = drawSectionHeader('Selected Vendor - Award Details', currentY);

      // Award banner
      doc.rect(margin, currentY, contentWidth, 50).fill('#dcfce7');
      doc.rect(margin, currentY, contentWidth, 50).stroke('#86efac');
      doc.rect(margin, currentY, 5, 50).fill(colors.success);

      doc.fontSize(14).fillColor(colors.success).text('VENDOR SELECTED', margin + 20, currentY + 10);
      doc.fontSize(18).fillColor(colors.text).text(detail.selectedVendorName || 'N/A', margin + 20, currentY + 28);

      // Selected badge
      doc.rect(pageWidth - margin - 100, currentY + 15, 90, 25).fill(colors.success);
      doc.fontSize(10).fillColor(colors.white).text('AWARDED', pageWidth - margin - 95, currentY + 22);

      currentY += 65;

      if (selectedBid) {
        // Selected Vendor Offer Details
        currentY = drawSectionHeader('Selected Vendor Offer Details', currentY);

        // Two-column layout for offer details
        const leftColX = margin;
        const rightColX = margin + contentWidth / 2 + 10;
        const detailRowHeight = 30;

        const drawDetailRow = (x: number, y: number, label: string, value: string, highlight?: boolean) => {
          const width = contentWidth / 2 - 20;
          if (highlight) {
            doc.rect(x, y, width, detailRowHeight).fill('#fef3c7');
          }
          doc.rect(x, y, width, detailRowHeight).stroke(colors.border);
          doc.fontSize(9).fillColor(colors.textLight).text(label, x + 10, y + 5);
          doc.fontSize(11).fillColor(colors.text).text(value, x + 10, y + 17);
        };

        // Left column
        drawDetailRow(leftColX, currentY, 'Vendor Name', selectedBid.vendorName);
        drawDetailRow(leftColX, currentY + detailRowHeight, 'Email', selectedBid.vendorEmail);
        drawDetailRow(leftColX, currentY + detailRowHeight * 2, 'Final Price', selectedBid.finalPrice ? `$${selectedBid.finalPrice.toLocaleString()}` : 'N/A', true);
        drawDetailRow(leftColX, currentY + detailRowHeight * 3, 'Unit Price', selectedBid.unitPrice ? `$${selectedBid.unitPrice.toLocaleString()}` : 'N/A');

        // Right column
        drawDetailRow(rightColX, currentY, 'Payment Terms', selectedBid.paymentTerms || 'N/A');
        drawDetailRow(rightColX, currentY + detailRowHeight, 'Delivery Date', selectedBid.deliveryDate ? new Date(selectedBid.deliveryDate).toLocaleDateString() : 'N/A');
        drawDetailRow(rightColX, currentY + detailRowHeight * 2, 'Utility Score', selectedBid.utilityScore ? `${(selectedBid.utilityScore * 100).toFixed(1)}%` : 'N/A', true);
        drawDetailRow(rightColX, currentY + detailRowHeight * 3, 'Deal Status', selectedBid.dealStatus || 'N/A');

        currentY += detailRowHeight * 4 + 20;

        // Savings Analysis
        if (detail.priceRange.highest && selectedBid.finalPrice) {
          currentY = drawSectionHeader('Cost Analysis', currentY);

          const savings = detail.priceRange.highest - selectedBid.finalPrice;
          const savingsPercent = ((savings / detail.priceRange.highest) * 100).toFixed(1);
          const vsAverage = detail.priceRange.average ? (detail.priceRange.average - selectedBid.finalPrice) : null;
          const vsTarget = detail.priceRange.targetPrice ? (detail.priceRange.targetPrice - selectedBid.finalPrice) : null;

          const analysisBoxWidth = (contentWidth - 30) / 4;
          const analysisBoxHeight = 70;

          const drawAnalysisBox = (x: number, y: number, label: string, value: string, subtext: string, positive: boolean) => {
            doc.rect(x, y, analysisBoxWidth, analysisBoxHeight).fill(positive ? '#dcfce7' : '#fef2f2');
            doc.rect(x, y, analysisBoxWidth, analysisBoxHeight).stroke(positive ? '#86efac' : '#fecaca');
            doc.fontSize(18).fillColor(positive ? colors.success : colors.danger).text(value, x, y + 15, { width: analysisBoxWidth, align: 'center' });
            doc.fontSize(9).fillColor(colors.text).text(label, x, y + 40, { width: analysisBoxWidth, align: 'center' });
            doc.fontSize(8).fillColor(colors.textLight).text(subtext, x, y + 52, { width: analysisBoxWidth, align: 'center' });
          };

          drawAnalysisBox(margin, currentY, 'vs Highest Bid', `$${savings.toLocaleString()}`, `${savingsPercent}% savings`, savings >= 0);
          if (vsAverage !== null) {
            drawAnalysisBox(margin + analysisBoxWidth + 10, currentY, 'vs Average', `$${Math.round(vsAverage).toLocaleString()}`, vsAverage >= 0 ? 'Below average' : 'Above average', vsAverage >= 0);
          }
          if (vsTarget !== null) {
            drawAnalysisBox(margin + (analysisBoxWidth + 10) * 2, currentY, 'vs Target', `$${Math.round(vsTarget).toLocaleString()}`, vsTarget >= 0 ? 'Under target' : 'Over target', vsTarget >= 0);
          }
          drawAnalysisBox(margin + (analysisBoxWidth + 10) * 3, currentY, 'Award Price', `$${selectedBid.finalPrice.toLocaleString()}`, 'Final negotiated', true);
        }
      }

      drawFooter(3, 3);
    }

    doc.end();
  } catch (error) {
    next(error);
  }
}
