#!/usr/bin/env tsx
/**
 * Comprehensive Email Service Test Script
 * Tests all 11 email flows with AWS SES
 *
 * Usage: npx tsx src/scripts/test-email-service.ts
 */

import { Buffer } from 'buffer';
import env from '../config/env.js';
import logger from '../config/logger.js';
import {
  sendVendorAttachedEmail,
  sendStatusChangeEmail,
  sendDealCreatedEmail,
  sendPmDealStatusNotificationEmail,
  sendDealSummaryPDFEmail,
  sendApprovalPendingEmail,
  sendApprovalApprovedEmail,
  sendApprovalRejectedEmail,
} from '../services/email.service.js';
import {
  sendComparisonEmail,
  sendVendorWonEmail,
  sendVendorLostEmail,
} from '../modules/bidComparison/bidComparison.email.js';

// Test recipient email
const TEST_EMAIL = 'vatsal.s@deuexsolutions.com';
const TEST_USER_ID = 1;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

interface TestResult {
  name: string;
  success: boolean;
  messageId?: string;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

function printHeader() {
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bright}${colors.cyan}AWS SES EMAIL SERVICE TEST SUITE${colors.reset}`);
  console.log('='.repeat(80));
  console.log(`Test Recipient: ${colors.yellow}${TEST_EMAIL}${colors.reset}`);
  console.log(`SES Host: ${colors.yellow}${env.smtp.host}${colors.reset}`);
  console.log(`SES Port: ${colors.yellow}${env.smtp.port}${colors.reset}`);
  console.log('='.repeat(80) + '\n');
}

function printTestStart(testName: string, testNumber: number) {
  console.log(`${colors.bright}[${testNumber}/11]${colors.reset} Testing: ${colors.blue}${testName}${colors.reset}...`);
}

function printTestResult(result: TestResult) {
  const status = result.success
    ? `${colors.green}✓ SUCCESS${colors.reset}`
    : `${colors.red}✗ FAILED${colors.reset}`;

  console.log(`  ${status} (${result.duration}ms)`);

  if (result.success && result.messageId) {
    console.log(`  Message ID: ${colors.cyan}${result.messageId}${colors.reset}`);
  }

  if (!result.success && result.error) {
    console.log(`  Error: ${colors.red}${result.error}${colors.reset}`);
  }

  console.log('');
}

function printSummary() {
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bright}${colors.cyan}TEST SUMMARY${colors.reset}`);
  console.log('='.repeat(80));
  console.log(`Total Tests: ${colors.bright}${results.length}${colors.reset}`);
  console.log(`Successful: ${colors.green}${successful}${colors.reset}`);
  console.log(`Failed: ${failed > 0 ? colors.red : colors.green}${failed}${colors.reset}`);
  console.log(`Total Duration: ${colors.yellow}${totalDuration}ms${colors.reset}`);
  console.log('='.repeat(80));

  if (failed > 0) {
    console.log(`\n${colors.red}${colors.bright}Failed Tests:${colors.reset}`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.name}: ${colors.red}${r.error}${colors.reset}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bright}📧 Check your inbox at: ${colors.yellow}${TEST_EMAIL}${colors.reset}`);
  console.log('='.repeat(80) + '\n');
}

async function runTest(testName: string, testNumber: number, testFn: () => Promise<any>): Promise<void> {
  printTestStart(testName, testNumber);
  const startTime = Date.now();

  try {
    const result = await testFn();
    const duration = Date.now() - startTime;

    const testResult: TestResult = {
      name: testName,
      success: result.success !== false,
      messageId: result.messageId,
      duration,
    };

    results.push(testResult);
    printTestResult(testResult);
  } catch (error) {
    const duration = Date.now() - startTime;
    const testResult: TestResult = {
      name: testName,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration,
    };

    results.push(testResult);
    printTestResult(testResult);
  }

  // Wait 500ms between tests to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 500));
}

async function main() {
  printHeader();

  // Test 1: Vendor Attached Email
  await runTest('Vendor Attached Email', 1, async () => {
    const mockContract = {
      id: 100,
      vendorId: TEST_USER_ID,
      uniqueToken: 'test-token-123',
      Vendor: {
        email: TEST_EMAIL,
        name: 'Test Vendor',
      },
    } as any;

    const mockRequisition = {
      id: 200,
      title: 'Test Requisition - Office Supplies',
      dueDate: new Date('2026-02-28'),
      Project: {
        name: 'Q1 2026 Procurement',
      },
      Products: [
        { name: 'Laptop', quantity: 10, targetPrice: 1200 },
        { name: 'Monitor', quantity: 20, targetPrice: 300 },
      ],
    } as any;

    await sendVendorAttachedEmail(mockContract, mockRequisition, 'deal-uuid-123');
    return { success: true };
  });

  // Test 2: Status Change Email
  await runTest('Status Change Email', 2, async () => {
    const mockContract = {
      id: 101,
      vendorId: TEST_USER_ID,
      Vendor: {
        email: TEST_EMAIL,
        name: 'Test Vendor',
      },
    } as any;

    const mockRequisition = {
      id: 201,
      title: 'Test Requisition - Hardware',
    } as any;

    await sendStatusChangeEmail(mockContract, mockRequisition, 'Created', 'Opened');
    return { success: true };
  });

  // Test 3: Deal Created Email
  await runTest('Deal Created Email', 3, async () => {
    return await sendDealCreatedEmail({
      dealId: 'test-deal-uuid-456',
      dealTitle: 'Q1 2026 Hardware Procurement',
      requisitionId: 202,
      rfqNumber: 'RFQ-2026-001',
      requisitionTitle: 'Hardware Purchase',
      projectName: 'IT Infrastructure Upgrade',
      vendorId: TEST_USER_ID,
      vendorName: 'Tech Solutions Inc',
      vendorEmail: TEST_EMAIL,
      negotiationDeadline: new Date('2026-02-15'),
      products: [
        { name: 'Server Rack', quantity: 5, targetPrice: 5000, unit: 'units' },
        { name: 'Network Switch', quantity: 10, targetPrice: 800, unit: 'units' },
      ],
      priceConfig: {
        targetUnitPrice: 90,
        maxAcceptablePrice: 100,
      },
      paymentTerms: {
        minDays: 30,
        maxDays: 90,
      },
      deliveryDate: '2026-03-01',
    });
  });

  // Test 4: PM Deal Status Notification - ACCEPTED
  await runTest('PM Deal Status Notification (ACCEPTED)', 4, async () => {
    return await sendPmDealStatusNotificationEmail({
      dealId: 'test-deal-uuid-789',
      dealTitle: 'Office Supplies Procurement',
      requisitionId: 203,
      rfqNumber: 'RFQ-2026-002',
      vendorName: 'Office Pro Suppliers',
      vendorCompanyName: 'Office Pro LLC',
      pmEmail: TEST_EMAIL,
      pmName: 'Test PM',
      pmUserId: TEST_USER_ID,
      newStatus: 'ACCEPTED',
      utility: 0.85,
      vendorOffer: {
        price: 9500,
        paymentTerms: 'Net 45',
      },
      reasoning: [
        'Price is within acceptable range',
        'Payment terms are favorable',
        'Utility score meets acceptance threshold (85%)',
      ],
    });
  });

  // Test 5: PM Deal Status Notification - ESCALATED
  await runTest('PM Deal Status Notification (ESCALATED)', 5, async () => {
    return await sendPmDealStatusNotificationEmail({
      dealId: 'test-deal-uuid-101',
      dealTitle: 'Software Licenses',
      requisitionId: 204,
      rfqNumber: 'RFQ-2026-003',
      vendorName: 'Software Vendor Co',
      pmEmail: TEST_EMAIL,
      pmName: 'Test PM',
      pmUserId: TEST_USER_ID,
      newStatus: 'ESCALATED',
      utility: 0.55,
      vendorOffer: {
        price: 15000,
        paymentTerms: 'Net 60',
      },
      reasoning: [
        'Price is in escalation zone',
        'Requires management review',
        'Utility score: 55% (escalation threshold: 30-70%)',
      ],
    });
  });

  // Test 6: Deal Summary PDF Email
  await runTest('Deal Summary PDF Email', 6, async () => {
    // Create a simple mock PDF buffer
    const pdfContent = 'Mock PDF Content - Deal Summary Report';
    const pdfBuffer = Buffer.from(pdfContent);

    return await sendDealSummaryPDFEmail({
      to: TEST_EMAIL,
      dealTitle: 'Q1 2026 Office Supplies',
      vendorName: 'Office Supplies Inc',
      rfqId: 205,
      pdfBuffer,
      filename: 'deal-summary-test.pdf',
    });
  });

  // Test 7: Approval Pending Email
  await runTest('Approval Pending Email', 7, async () => {
    return await sendApprovalPendingEmail({
      recipientEmail: TEST_EMAIL,
      recipientName: 'Test Approver',
      requisitionId: 206,
      requisitionTitle: 'Marketing Materials Purchase',
      projectName: 'Q1 Marketing Campaign',
      submittedBy: 'John Doe',
      amount: 25000,
      approvalLevel: 'L2',
      approvalId: 301,
      priority: 'HIGH',
      dueDate: new Date('2026-02-10'),
    });
  });

  // Test 8: Approval Approved Email
  await runTest('Approval Approved Email', 8, async () => {
    return await sendApprovalApprovedEmail({
      recipientEmail: TEST_EMAIL,
      recipientName: 'Test Requester',
      requisitionId: 207,
      requisitionTitle: 'IT Equipment Purchase',
      projectName: 'IT Infrastructure',
      amount: 50000,
      approvalLevel: 'L1',
      approvedBy: 'Jane Manager',
      nextLevel: 'L2',
    });
  });

  // Test 9: Approval Rejected Email
  await runTest('Approval Rejected Email', 9, async () => {
    return await sendApprovalRejectedEmail({
      recipientEmail: TEST_EMAIL,
      recipientName: 'Test Requester',
      requisitionId: 208,
      requisitionTitle: 'Conference Room Upgrade',
      projectName: 'Office Improvements',
      amount: 75000,
      approvalLevel: 'L3',
      rejectedBy: 'CFO Smith',
      reason: 'Budget constraints for Q1. Please resubmit in Q2 with revised cost estimates.',
    });
  });

  // Test 10: Bid Comparison Report Email
  await runTest('Bid Comparison Report Email', 10, async () => {
    // Create a mock PDF file
    const pdfContent = 'Mock PDF - Bid Comparison Report';
    const pdfPath = '/tmp/test-bid-comparison.pdf';
    const fs = await import('fs');
    fs.writeFileSync(pdfPath, pdfContent);

    return await sendComparisonEmail({
      recipientEmail: TEST_EMAIL,
      recipientName: 'Test PM',
      requisitionId: 209,
      requisitionTitle: 'Annual Office Supplies Contract',
      projectName: 'Facilities Management',
      rfqId: 'RFQ-2026-004',
      topBids: [
        {
          bidId: 'bid-1',
          vendorId: 1,
          vendorName: 'Vendor Alpha',
          finalPrice: 45000,
          utilityScore: 0.92,
          dealStatus: 'ACCEPTED' as any,
          bidStatus: 'COMPLETED' as any,
          rank: 1,
        },
        {
          bidId: 'bid-2',
          vendorId: 2,
          vendorName: 'Vendor Beta',
          finalPrice: 48000,
          utilityScore: 0.85,
          dealStatus: 'ACCEPTED' as any,
          bidStatus: 'COMPLETED' as any,
          rank: 2,
        },
        {
          bidId: 'bid-3',
          vendorId: 3,
          vendorName: 'Vendor Gamma',
          finalPrice: 52000,
          utilityScore: 0.78,
          dealStatus: 'ACCEPTED' as any,
          bidStatus: 'COMPLETED' as any,
          rank: 3,
        },
      ],
      totalVendors: 5,
      completedVendors: 3,
      triggeredBy: 'ALL_COMPLETED',
      pdfPath,
    });
  });

  // Test 11: Vendor Won Email
  await runTest('Vendor Won Email', 11, async () => {
    return await sendVendorWonEmail({
      recipientEmail: TEST_EMAIL,
      vendorName: 'Test Vendor Inc',
      requisitionTitle: 'Manufacturing Equipment Purchase',
      projectName: 'Factory Expansion',
      selectedPrice: 125000,
      chatSummary: 'Successfully negotiated price from $135,000 to $125,000 with Net 60 payment terms.',
    });
  });

  // Test 12: Vendor Lost Email (Bonus test)
  await runTest('Vendor Lost Email (Bonus)', 12, async () => {
    return await sendVendorLostEmail({
      recipientEmail: TEST_EMAIL,
      vendorName: 'Test Vendor Inc',
      requisitionTitle: 'Manufacturing Equipment Purchase',
      projectName: 'Factory Expansion',
      bidPrice: 135000,
      winningPrice: 125000,
    });
  });

  printSummary();

  // Exit with appropriate code
  const hasFailures = results.some(r => !r.success);
  process.exit(hasFailures ? 1 : 0);
}

// Run the test suite
main().catch((error) => {
  console.error(`${colors.red}${colors.bright}Fatal Error:${colors.reset}`, error);
  process.exit(1);
});
