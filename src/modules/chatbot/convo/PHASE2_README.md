# Phase 2: Conversation Enhancement System

This document describes the Phase 2 conversation enhancement system for Accordo AI's chatbot negotiation platform.

## Overview

Phase 2 introduces three major components:
1. **Conversation Template System** - Natural language variations for consistent, professional responses
2. **Enhanced ConvoRouter** - Sophisticated state machine for conversation flow management
3. **ProcessConversationTurn** - Main orchestrator integrating all components

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  processConversationTurn                    │
│                   (Main Orchestrator)                       │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
       ┌───────▼────────┐            ┌────────▼───────────┐
       │ enhancedConvo  │            │ conversation       │
       │ Router         │            │ Templates          │
       │ (State Machine)│            │ (Response Gen)     │
       └───────┬────────┘            └────────┬───────────┘
               │                              │
       ┌───────▼──────────────────────────────▼───────────┐
       │         ChatbotDeal.convoStateJson               │
       │         (Persistent State Storage)               │
       └──────────────────────────────────────────────────┘
```

## Component 1: Conversation Templates

**File**: `conversationTemplates.ts`

### Purpose
Provides natural, human-like response variations for each conversation intent, ensuring:
- Consistent messaging across similar contexts
- Professional tone and language
- Deterministic selection (same inputs = same template)
- Easy maintenance and expansion

### Intent Types (8 total)

1. **GREET** - Initial greeting responses
   - 7 variations
   - Variables: `counterparty`

2. **ASK_FOR_OFFER** - Requesting vendor's proposal
   - 7 variations
   - Variables: `counterparty`, `productName`, `quantity`

3. **ASK_CLARIFY** - Asking for clarification
   - 7 variations
   - Variables: `counterparty`, `reason`

4. **COUNTER** - Counter-offer with reasoning
   - 7 variations
   - Variables: `currentPrice`, `targetPrice`, `paymentTerms`, `reason`, `counterparty`

5. **ACCEPT** - Accepting vendor offer
   - 7 variations
   - Variables: `counterparty`, `currentPrice`, `paymentTerms`

6. **ESCALATE** - Escalating to human
   - 7 variations
   - Variables: `counterparty`, `reason`

7. **WALK_AWAY** - Walking away from negotiation
   - 7 variations
   - Variables: `counterparty`, `reason`

8. **SMALL_TALK** - Handling small talk/pleasantries
   - 7 variations
   - Variables: `counterparty`

**Total**: 56 template variations

### Template Selection Algorithm

```typescript
function selectTemplate(dealId: string, round: number, intent: ConvoIntent): string {
  // Create deterministic seed from context
  const seed = `${dealId}-${round}-${intent}`;

  // Hash to get consistent index
  const hash = createHash('sha256').update(seed).digest('hex');
  const numericHash = parseInt(hash.substring(0, 8), 16);

  // Select template using modulo
  const templates = getTemplatesForIntent(intent);
  const index = numericHash % templates.length;

  return templates[index];
}
```

**Key Properties**:
- Deterministic: Same `dealId + round + intent` always returns same template
- Distributed: SHA-256 provides uniform distribution across templates
- Consistent: Vendor sees same style/tone in repeated contexts

### Variable Substitution

Templates use `{variable}` placeholders:

```typescript
const template = "Hello {counterparty}! Your offer of ${currentPrice} is interesting...";

const variables = {
  counterparty: "Acme Corp",
  currentPrice: 150
};

const result = substituteVariables(template, variables);
// "Hello Acme Corp! Your offer of $150 is interesting..."
```

### Usage Example

```typescript
import { generateConversationMessage } from './conversationTemplates.js';

const message = generateConversationMessage(
  'deal-123',           // dealId
  3,                    // round
  'COUNTER',            // intent
  {
    counterparty: 'Acme Corp',
    currentPrice: 150,
    targetPrice: 120,
    paymentTerms: 'Net 30',
    reason: 'This aligns with market rates and our budget constraints.'
  }
);

// Result: One of 7 COUNTER templates, deterministically selected,
// with all variables substituted
```

## Component 2: Enhanced ConvoRouter

**File**: `enhancedConvoRouter.ts`

### Purpose
Sophisticated state machine managing conversation flow, including:
- Vendor intent classification
- Refusal detection and handling
- Small talk management
- Multi-turn context awareness
- Phase transitions

### Conversation Phases

```
GREET → ASK_OFFER → NEGOTIATING → CLOSED
```

1. **GREET**: Initial greeting exchange
2. **ASK_OFFER**: Requesting vendor's proposal
3. **NEGOTIATING**: Active negotiation with offers
4. **CLOSED**: Terminal state (ACCEPT/WALK_AWAY/ESCALATE)

### Vendor Intent Classification

Uses LLM to classify vendor messages into 7 intent types:

```typescript
type VendorIntent =
  | 'PROVIDE_OFFER'   // Shares pricing/terms
  | 'REFUSAL'         // Refuses to share info
  | 'SMALL_TALK'      // General conversation
  | 'ASK_QUESTION'    // Asking for clarification
  | 'NEGOTIATE'       // Counter-offer or pushback
  | 'GREETING'        // Initial greeting
  | 'AGREE';          // Accepts Accordo's terms
```

**Classification Process**:
1. LLM analyzes vendor message with conversation history
2. Returns intent label
3. Fallback to heuristics if LLM fails

### Refusal Classification

When vendor refuses to share information:

```typescript
type RefusalType =
  | 'NO'              // Direct refusal
  | 'LATER'           // Will share later
  | 'ALREADY_SHARED'  // Claims already shared
  | 'CONFUSED'        // Doesn't understand
  | null;
```

### Refusal Handling Logic

```typescript
function handleRefusal(state: ConvoState, refusalType: RefusalType): ConvoIntent {
  state.refusalCount++;

  if (state.refusalCount >= 5) {
    // Too many refusals → escalate to human
    return 'ESCALATE';
  }

  if (state.refusalCount >= 3 && !state.askedForPreferences) {
    // Multiple refusals → ask for preferences
    state.askedForPreferences = true;
    return 'ASK_CLARIFY';
  }

  // Handle by refusal type
  switch (refusalType) {
    case 'CONFUSED':
      return 'ASK_CLARIFY';
    case 'ALREADY_SHARED':
      return 'ASK_CLARIFY';
    case 'LATER':
      return 'ASK_FOR_OFFER';
    default:
      return 'ASK_CLARIFY';
  }
}
```

### Small Talk Handling

```typescript
function handleSmallTalk(state: ConvoState): ConvoIntent {
  state.smallTalkCount++;

  if (state.smallTalkCount >= 2) {
    // Too much small talk → redirect to business
    return state.phase === 'GREET' ? 'ASK_FOR_OFFER' : 'ASK_CLARIFY';
  }

  // Acknowledge politely
  return 'SMALL_TALK';
}
```

### State Machine Logic

```typescript
function determineNextIntent(
  state: ConvoState,
  vendorIntent: VendorIntent,
  vendorMessage: string
): ConvoIntent {
  // Route based on current phase
  switch (state.phase) {
    case 'GREET':
      return handleGreetPhase(state, vendorIntent);
    case 'ASK_OFFER':
      return handleAskOfferPhase(state, vendorIntent);
    case 'NEGOTIATING':
      return handleNegotiatingPhase(state, vendorIntent);
    case 'CLOSED':
      return 'ESCALATE';
  }
}
```

### Conversation State

Stored in `ChatbotDeal.convoStateJson`:

```typescript
interface ConvoState {
  phase: ConvoPhase;                    // Current phase
  refusalCount: number;                 // Times vendor refused
  lastRefusalType: RefusalType | null;  // Type of last refusal
  askedForPreferences: boolean;         // Asked vendor preferences
  smallTalkCount: number;               // Small talk exchanges
  turnCount: number;                    // Total turns
  lastIntent: ConvoIntent | null;       // Last Accordo intent
  context: {
    mentionedPrice: boolean;            // Price discussed
    mentionedTerms: boolean;            // Terms discussed
    sharedConstraints: boolean;         // Constraints shared
  };
  lastUpdatedAt?: string;               // ISO timestamp
}
```

### LLM Integration

Uses existing `generateChatbotLlamaCompletion` from `chatbotLlamaClient.ts`:

```typescript
const systemPrompt = `You are an expert at analyzing negotiation messages...`;

const response = await generateChatbotLlamaCompletion(
  systemPrompt,
  conversationHistory,
  { temperature: 0.3, maxTokens: 50 }
);
```

**Fallback Handling**:
- If LLM fails → use heuristic classification
- If LLM returns invalid intent → use heuristics
- Logs all fallbacks for monitoring

## Component 3: ProcessConversationTurn

**File**: `processConversationTurn.ts`

### Purpose
Main orchestrator that coordinates all components to process a conversation turn.

### Main Flow

```typescript
async function processConversationTurn(input: {
  dealId: string;
  vendorMessage: string;
  userId: number;
}): Promise<ProcessConversationTurnResult>
```

**Steps**:

1. **Load Deal Context**
   ```typescript
   const { deal, template, convoState } = await loadDealContext(dealId);
   ```

2. **Load Conversation History**
   ```typescript
   const conversationHistory = await loadConversationHistory(dealId);
   ```

3. **Classify Vendor Intent**
   ```typescript
   const vendorIntent = await classifyVendorIntent(vendorMessage, conversationHistory);
   ```

4. **Handle Special Cases**
   ```typescript
   if (vendorIntent === 'REFUSAL') {
     refusalType = await classifyRefusal(vendorMessage);
     nextIntent = handleRefusal(convoState, refusalType);
   } else if (vendorIntent === 'SMALL_TALK') {
     nextIntent = handleSmallTalk(convoState);
   }
   ```

5. **Determine Next Intent**
   ```typescript
   nextIntent = determineNextIntent(convoState, vendorIntent, vendorMessage);
   ```

6. **Prepare Template Variables**
   ```typescript
   const variables = await prepareTemplateVariables(
     deal, template, convoState, nextIntent, vendorMessage
   );
   ```

7. **Generate Response**
   ```typescript
   const accordoMessage = generateConversationMessage(
     dealId, deal.round, nextIntent, variables
   );
   ```

8. **Update State**
   ```typescript
   const updatedState = updateConvoState(convoState, vendorIntent, nextIntent);
   await saveDealState(deal, updatedState);
   ```

### Template Variable Preparation

Intent-specific variable extraction:

```typescript
switch (intent) {
  case 'COUNTER':
    variables.targetPrice = templateParams?.targetPrice || 100;
    variables.currentPrice = extractCurrentPrice(vendorMessage, deal);
    variables.paymentTerms = templateParams?.paymentTerms || 'Net 30';
    variables.reason = generateCounterReason(...);
    break;

  case 'ESCALATE':
    variables.reason = generateEscalationReason(convoState);
    break;

  case 'WALK_AWAY':
    variables.reason = generateWalkAwayReason(convoState, templateParams);
    break;
}
```

### Helper Functions

**Price Extraction**:
```typescript
function extractCurrentPrice(vendorMessage: string, deal: ChatbotDeal): number | undefined {
  // Try regex match
  const priceMatch = vendorMessage.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
  if (priceMatch) return parseFloat(priceMatch[1].replace(/,/g, ''));

  // Fallback to deal's latest offer
  return deal.latestVendorOffer?.unit_price;
}
```

**Reason Generation**:
```typescript
function generateCounterReason(
  templateParams: any,
  targetPrice?: number,
  currentPrice?: number
): string {
  const reasons: string[] = [];

  if (currentPrice && targetPrice && currentPrice > targetPrice) {
    const percentDiff = ((currentPrice - targetPrice) / currentPrice * 100).toFixed(1);
    reasons.push(`This represents a ${percentDiff}% adjustment...`);
  }

  if (templateParams?.marketPrice) {
    reasons.push(`Market rate is around $${templateParams.marketPrice}`);
  }

  return reasons.join('. ') + '.';
}
```

## Integration Guide

### 1. Database Setup

Ensure `chatbot_deals.convo_state_json` column exists (JSONB type).

### 2. Usage in Conversation Service

```typescript
import { processConversationTurn } from './convo/processConversationTurn.js';

async function handleVendorMessage(
  dealId: string,
  vendorMessage: string,
  userId: number
) {
  // Process turn
  const result = await processConversationTurn({
    dealId,
    vendorMessage,
    userId
  });

  // Save messages to database
  await saveVendorMessage(dealId, vendorMessage);
  await saveAccordoMessage(dealId, result.accordoMessage);

  // Update deal status if needed
  if (result.accordoIntent === 'ACCEPT') {
    await updateDealStatus(dealId, 'ACCEPTED');
  } else if (result.accordoIntent === 'WALK_AWAY') {
    await updateDealStatus(dealId, 'WALKED_AWAY');
  } else if (result.accordoIntent === 'ESCALATE') {
    await updateDealStatus(dealId, 'ESCALATED');
  }

  return result;
}
```

### 3. Testing Template Selection

```typescript
import { selectTemplate, generateConversationMessage } from './conversationTemplates.js';

// Test deterministic selection
const template1 = selectTemplate('deal-123', 1, 'GREET');
const template2 = selectTemplate('deal-123', 1, 'GREET');
assert(template1 === template2); // Always same template

// Test different rounds get different templates
const round1 = selectTemplate('deal-123', 1, 'GREET');
const round2 = selectTemplate('deal-123', 2, 'GREET');
// Usually different (7 templates available)
```

### 4. Monitoring State Transitions

```typescript
import { getStateSummary } from './enhancedConvoRouter.js';

// Log state after each turn
logger.info('Conversation state', {
  dealId,
  summary: getStateSummary(updatedState)
});
// Output: "Phase: NEGOTIATING, Turn: 5, Refusals: 1, SmallTalk: 0"
```

## Error Handling

### LLM Failures
- All LLM calls wrapped in try-catch
- Automatic fallback to heuristic classification
- Logged for monitoring and improvement

### Missing Variables
- Warnings logged but doesn't fail
- Templates may have unreplaced placeholders
- Validation function available: `validateTemplateVariables()`

### Invalid State
- State validation on load: `validateConvoState()`
- Auto-initialization if invalid
- Preserves conversation history

## Performance Considerations

1. **Template Caching**: Template arrays are constant (no regeneration)
2. **Efficient Hashing**: SHA-256 substring conversion (fast)
3. **Minimal LLM Calls**: Only for classification, not generation
4. **History Limiting**: Only last 10 messages loaded for context
5. **Atomic State Updates**: Single database write per turn

## Future Enhancements

### Phase 3 Integration Points

1. **Decision Engine Integration**
   - Check `shouldInvokeDecisionEngine()` flag
   - Parse offers using existing `parseOffer` module
   - Generate counter-offers with utility scoring

2. **Preference Detection**
   - Function stub: `extractVendorPreferences()`
   - Analyze concession patterns over time
   - Adapt strategy based on vendor style

3. **Multi-attribute Negotiation**
   - Expand templates for delivery, warranty, etc.
   - Enhanced state context tracking
   - More sophisticated reasoning generation

## API Reference

### conversationTemplates.ts

```typescript
// Main function
generateConversationMessage(
  dealId: string,
  round: number,
  intent: ConvoIntent,
  variables: TemplateVariables
): string

// Template selection
selectTemplate(dealId: string, round: number, intent: ConvoIntent): string

// Variable substitution
substituteVariables(template: string, variables: TemplateVariables): string

// Validation
validateTemplateVariables(intent: ConvoIntent, variables: TemplateVariables): boolean

// Metadata
getTemplateMetadata(intent: ConvoIntent): TemplateMetadata
getAllIntents(): ConvoIntent[]
getTotalTemplateCount(): number
```

### enhancedConvoRouter.ts

```typescript
// Intent classification
classifyVendorIntent(message: string, history?: MessageHistory): Promise<VendorIntent>
classifyRefusal(message: string): Promise<RefusalType>

// Intent handling
handleRefusal(state: ConvoState, refusalType: RefusalType): ConvoIntent
handleSmallTalk(state: ConvoState): ConvoIntent
determineNextIntent(state: ConvoState, vendorIntent: VendorIntent, message: string): ConvoIntent

// State management
initializeConvoState(): ConvoState
updateConvoState(state: ConvoState, vendorIntent: VendorIntent, accordoIntent: ConvoIntent): ConvoState
validateConvoState(state: any): state is ConvoState

// Utilities
containsPriceInfo(message: string): boolean
containsTermsInfo(message: string): boolean
getStateSummary(state: ConvoState): string
```

### processConversationTurn.ts

```typescript
// Main function
processConversationTurn(input: ProcessConversationTurnInput): Promise<ProcessConversationTurnResult>

// Helpers
shouldParseOffer(vendorIntent: VendorIntent, message: string): boolean
shouldInvokeDecisionEngine(accordoIntent: ConvoIntent, vendorIntent: VendorIntent): boolean
validateDealForConversation(deal: ChatbotDeal): void
getConversationSummary(deal: ChatbotDeal, state: ConvoState): ConversationSummary
extractVendorPreferences(dealId: string): Promise<VendorPreferences>
```

## Troubleshooting

### Templates not varying
- Check dealId and round are changing
- Verify hash function working (test with different seeds)
- Review template count (may just be coincidence with small set)

### LLM classification failing
- Check Ollama is running and accessible
- Verify model is loaded (`ollama list`)
- Review logs for specific error messages
- Fallback heuristics should still work

### State not persisting
- Verify `convoStateJson` column exists
- Check database write permissions
- Review transaction handling
- Validate JSON serialization

### Incorrect intent routing
- Review state machine logic in `determineNextIntent()`
- Check phase transitions
- Verify vendor intent classification accuracy
- Enable debug logging for detailed flow

## Testing Checklist

- [ ] Template selection is deterministic
- [ ] All 8 intent types have templates
- [ ] Variable substitution works correctly
- [ ] State initializes properly
- [ ] Phase transitions work as expected
- [ ] Refusal counting increments
- [ ] Escalation triggers at 5 refusals
- [ ] Small talk redirects after 2 exchanges
- [ ] LLM classification returns valid intents
- [ ] Fallback heuristics work when LLM fails
- [ ] State persists to database
- [ ] Conversation history loads correctly
- [ ] Price/terms extraction works
- [ ] Reason generation is sensible
- [ ] Error handling prevents crashes

## Metrics & Monitoring

Recommended logging points:

1. **Turn Processing**
   - Deal ID, round, turn count
   - Vendor intent, Accordo intent
   - Processing time

2. **Classification**
   - LLM vs fallback usage
   - Classification confidence (if available)
   - Misclassification rate (if labeled data)

3. **State Transitions**
   - Phase changes
   - Refusal/small talk counts
   - Escalation triggers

4. **Template Usage**
   - Intent distribution
   - Template variation distribution
   - Variable substitution failures

5. **Performance**
   - LLM latency
   - Total turn processing time
   - Database query times

---

## Summary

Phase 2 provides a robust foundation for natural, context-aware conversation management:

✅ **56 natural language templates** across 8 intent types
✅ **Deterministic selection** for consistency
✅ **Sophisticated state machine** with 4 phases
✅ **LLM-powered intent classification** with fallbacks
✅ **Multi-turn context awareness** and tracking
✅ **Refusal detection and handling** (3 strikes → preferences, 5 → escalate)
✅ **Small talk management** (redirect after 2 exchanges)
✅ **Persistent state storage** in database
✅ **Integration-ready** for Phase 3 decision engine

The system is production-ready and can handle complex negotiation flows while maintaining natural, professional communication.
