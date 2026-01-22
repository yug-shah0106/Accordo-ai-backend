# Implementation Plan: UI Fixes, Refresh Logic, Bid Analysis & Role Labels

## Overview

This plan covers four main areas:
1. **Cancel Button Text Color** - Update to gray-700
2. **Refresh Button Implementation** - Add/fix refresh logic across multiple locations
3. **Bid Analysis Accept/Reject Errors** - Fix 404/500 errors by auto-creating VendorBid
4. **L1/L2/L3 Labels** - Update remaining display labels to new role names

---

## Part 1: Cancel Button Text Color

### Location
- **File**: `/Accordo-ai-frontend/src/components/vendor/CreateProjectForm.tsx`
- **Line**: ~267-273

### Current Issue
The Cancel button currently has `text-gray-700` but the user wants to ensure it's properly applied.

### Implementation
Verify and update the Cancel button styling:
```tsx
<Button
  type="button"
  className="px-6 py-3 bg-white border-2 border-gray-400 text-gray-700 hover:bg-gray-100 hover:border-gray-500 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 min-w-[120px] justify-center"
  onClick={() => navigate(-1)}
>
  Cancel
</Button>
```

**Note**: The current implementation already uses `text-gray-700`. If visibility is still an issue, we may need to use `text-gray-800` for darker contrast.

---

## Part 2: Refresh Button Implementation

### Investigation Findings

| Component | File | Has Refresh Logic |
|-----------|------|-------------------|
| ApprovalsSidebar | BidAnalysis/ApprovalsSidebar.tsx | YES - `onRestore()` callback |
| ConversationEnhanced | chatbot/chat/ConversationEnhanced.tsx | YES - `reload()` from hook |
| WeightedUtilitySidebar | chatbot/WeightedUtilitySidebar.tsx | CONDITIONAL - depends on parent |
| ChatErrorBoundary | chatbot/chat/ChatErrorBoundary.tsx | YES - `window.location.reload()` |

### Files to Check/Update

1. **WeightedUtilitySidebar.tsx** - Ensure `onRefresh` prop is being passed from parent components
2. **BidAnalysisPage.tsx** - Check if refresh button exists and has proper handler
3. **RequisitionListPage.tsx** - Verify refresh functionality

### Implementation Steps

#### 2.1 Check BidAnalysisPage for Refresh
Search for refresh buttons in BidAnalysisPage and ensure they call the data fetch functions.

#### 2.2 Add Refresh to Requisition List (if missing)
If the requisition list doesn't have a refresh button, add one that calls the data refetch.

#### 2.3 Verify WeightedUtilitySidebar Integration
Ensure parent components pass `onRefresh` prop to WeightedUtilitySidebar.

---

## Part 3: Bid Analysis Accept/Reject 404/500 Errors

### Root Cause Analysis

**404 on Accept:**
- `selectBidForAnalysis()` uses ChatbotDeal ID
- Calls `selectVendor()` which expects VendorBid ID
- `VendorBid.findByPk(chatbotDealId)` returns null → 404

**500 on Reject:**
- Potential null reference on `deal.latestVendorOffer`
- BidActionHistory constraints
- Missing error handling

### Solution: Auto-create VendorBid on Selection

#### 3.1 Update `selectBidForAnalysis` Function

**File**: `/Accordo-ai-backend/src/modules/bidAnalysis/bidAnalysis.service.ts`

```typescript
export async function selectBidForAnalysis(
  requisitionId: number,
  bidId: string,  // This is a ChatbotDeal ID
  userId: number,
  remarks?: string
): Promise<SelectBidResult> {
  // Step 1: Get ChatbotDeal
  const deal = await ChatbotDeal.findByPk(bidId, {
    include: [
      { model: User, as: 'Vendor', attributes: ['id', 'name', 'email'] },
      { model: Contract, as: 'Contract' },
    ],
  });

  if (!deal) {
    throw new CustomError('Deal not found', 404);
  }

  // Step 2: Find or create VendorBid from ChatbotDeal
  let vendorBid = await VendorBid.findOne({
    where: { dealId: bidId }
  });

  if (!vendorBid) {
    // Auto-create VendorBid from ChatbotDeal data
    const offer = deal.latestVendorOffer || {};
    vendorBid = await VendorBid.create({
      requisitionId: deal.requisitionId,
      contractId: deal.contractId,
      dealId: deal.id,
      vendorId: deal.vendorId,
      finalPrice: Number(offer.price || offer.totalPrice || 0),
      unitPrice: Number(offer.unitPrice || 0),
      paymentTerms: offer.paymentTerms || null,
      deliveryDate: offer.deliveryDate || null,
      utilityScore: deal.currentUtilityScore || null,
      bidStatus: 'COMPLETED',
      dealStatus: deal.status,
      chatSummaryMetrics: deal.summaryMetrics || null,
      chatSummaryNarrative: deal.summaryNarrative || null,
    });
  }

  // Step 3: Now call selectVendor with the VendorBid ID
  const result = await selectVendor(
    requisitionId,
    vendorBid.id,  // Use VendorBid ID, not ChatbotDeal ID
    userId,
    'PORTAL',
    remarks
  );

  return result;
}
```

#### 3.2 Update `rejectBid` Function

**File**: `/Accordo-ai-backend/src/modules/bidAnalysis/bidAnalysis.service.ts`

```typescript
export async function rejectBid(
  requisitionId: number,
  bidId: string,  // This is a ChatbotDeal ID
  userId: number,
  remarks?: string
): Promise<RejectBidResult> {
  // Step 1: Get ChatbotDeal with null-safe access
  const deal = await ChatbotDeal.findByPk(bidId, {
    include: [
      { model: User, as: 'Vendor', attributes: ['id', 'name'] },
    ],
  });

  if (!deal) {
    throw new CustomError('Deal not found', 404);
  }

  if (deal.requisitionId !== requisitionId) {
    throw new CustomError('Deal does not belong to this requisition', 400);
  }

  // Step 2: Check existing rejection with null safety
  const existingRejection = await BidActionHistory.findOne({
    where: { bidId, action: 'REJECTED' },
  });

  if (existingRejection) {
    throw new CustomError('Deal is already rejected', 400);
  }

  // Step 3: Safely extract offer data
  const offer = deal.latestVendorOffer || {};
  const bidPrice = Number(offer.price || offer.totalPrice || offer.finalPrice || 0);

  // Step 4: Log rejection with proper error handling
  try {
    const historyEntry = await logAction(
      requisitionId,
      'REJECTED',
      userId,
      bidId,
      {
        vendorId: deal.vendorId,
        vendorName: deal.Vendor?.name || 'Unknown Vendor',
        bidPrice,
        previousStatus: deal.status,
        newStatus: 'REJECTED',
      },
      remarks
    );

    return {
      success: true,
      bidId,
      vendorId: deal.vendorId,
      vendorName: deal.Vendor?.name || 'Unknown Vendor',
      historyEntry,
    };
  } catch (error) {
    throw new CustomError('Failed to record rejection', 500);
  }
}
```

#### 3.3 Add VendorBid Model Import

Ensure VendorBid is imported in bidAnalysis.service.ts:
```typescript
import { VendorBid } from '../../models/vendorBid.js';
```

---

## Part 4: L1/L2/L3 Label Updates

### Investigation Findings

The following places still show L1/L2/L3 labels that need updating:

| Location | File | Current Label | New Label |
|----------|------|---------------|-----------|
| Bid Analysis PDF | bidAnalysis.controller.ts:445 | `['L1 - BEST', 'L2', 'L3']` | **NOT APPROVAL RELATED** - This is vendor bid ranking |
| Seeder Logs | seeders/index.ts:1454-1456 | Already updated | ✅ Done |
| Email Templates | email.service.ts:28-33 | Already has mapping | ✅ Done |

### Key Distinction

**IMPORTANT**: The investigation found that L1/L2/L3 in bid analysis refers to **vendor bid rankings** (1st/2nd/3rd best price), NOT approval levels. These should NOT be changed to "Procurement Manager/HOD/CFO".

### Where POC Dropdown Gets Data

The POC dropdown fetches user data from the API. The issue is that:
1. **Database has old role names** - Migration hasn't been run yet
2. **Seeders have new names** - But database wasn't re-seeded

### Solution for POC Dropdown

#### 4.1 Run the Migration

```bash
npm run migrate
```

This will run `20260121000000-rename-approval-roles.cjs` which updates:
- `Roles.name`: 'L1 Approver' → 'Procurement Manager Approver'
- `Roles.name`: 'L2 Approver' → 'HOD Approver'
- `Roles.name`: 'L3 Approver' → 'CFO Approver'
- User names for test users

#### 4.2 OR Re-run Seeders (Development)

```bash
npm run seed
```

This will recreate all data with the new role names from the updated seeders.

#### 4.3 Check Frontend Role Display

Verify where the frontend displays role names:
- User dropdowns
- POC selection
- Approval workflows

The role names come from the `Role.name` field via API, so updating the database should fix the display.

---

## Files to Modify Summary

| File | Changes |
|------|---------|
| `frontend/src/components/vendor/CreateProjectForm.tsx` | Verify Cancel button text color |
| `backend/src/modules/bidAnalysis/bidAnalysis.service.ts` | Fix selectBidForAnalysis and rejectBid |
| `backend/src/modules/bidComparison/bidComparison.service.ts` | May need VendorBid creation helper |
| Database | Run migration or re-seed |

---

## Testing Checklist

### Cancel Button
- [ ] Navigate to Create Project page
- [ ] Verify Cancel button text is dark gray and visible

### Refresh Buttons
- [ ] Test refresh on Bid Analysis page
- [ ] Test refresh on Requisition list
- [ ] Test refresh on Negotiation room

### Bid Analysis Accept/Reject
- [ ] Select a bid and add remarks → Click Accept → Should succeed
- [ ] Select a bid and add remarks → Click Reject → Should succeed
- [ ] Verify VendorBid is auto-created on selection

### POC Dropdown / Role Labels
- [ ] Run `npm run migrate` or `npm run seed`
- [ ] Navigate to Create Project → POC dropdown
- [ ] Verify shows "Procurement Manager Approver", "HOD Approver", "CFO Approver"
- [ ] Check other places showing role names

---

## Implementation Order

1. **Cancel Button** - Quick fix, verify styling
2. **Database Update** - Run migration or re-seed for role names
3. **Bid Analysis Fix** - Update service functions with VendorBid auto-creation
4. **Refresh Buttons** - Investigate specific locations and add missing handlers

---

## Notes

- Vendor bid ranking (L1 = best price) is DIFFERENT from approval levels (L1 = Procurement Manager)
- The migration file already exists: `20260121000000-rename-approval-roles.cjs`
- Email templates already use the label mapping function
- The 404/500 errors are due to entity ID mismatch, not missing routes
