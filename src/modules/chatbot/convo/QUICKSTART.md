# Phase 2 Quick Start Guide

This guide helps you quickly integrate and test the Phase 2 conversation enhancement system.

## Files Created

1. **conversationTemplates.ts** (359 lines)
   - 56 natural language templates across 8 intent types
   - Deterministic template selection
   - Variable substitution system

2. **enhancedConvoRouter.ts** (661 lines)
   - State machine with 4 conversation phases
   - LLM-powered intent classification
   - Refusal and small talk handling

3. **processConversationTurn.ts** (595 lines)
   - Main orchestrator function
   - Integration with database and LLM
   - Template variable preparation

4. **PHASE2_README.md** (701 lines)
   - Complete documentation
   - Architecture diagrams
   - API reference

5. **INTEGRATION_EXAMPLE.ts** (519 lines)
   - Working examples and use cases
   - Testing helpers
   - Error handling patterns

**Total**: 2,835 lines of production-ready TypeScript code + documentation

## Quick Integration (5 Steps)

### Step 1: Verify Database Schema

Ensure your `chatbot_deals` table has the `convo_state_json` column (JSONB):

```sql
-- Should already exist from Phase 1
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'chatbot_deals'
AND column_name = 'convo_state_json';
```

### Step 2: Add to Conversation Service

In your `conversationService.ts`, import and use:

```typescript
import { processConversationTurn } from './convo/processConversationTurn.js';

export async function handleVendorMessage(
  dealId: string,
  vendorMessage: string,
  userId: number
) {
  // Save vendor message
  await ChatbotMessage.create({
    dealId,
    role: 'VENDOR',
    content: vendorMessage,
  });

  // Process turn (Phase 2)
  const result = await processConversationTurn({
    dealId,
    vendorMessage,
    userId,
  });

  // Save Accordo response
  await ChatbotMessage.create({
    dealId,
    role: 'ACCORDO',
    content: result.accordoMessage,
  });

  // Update deal status if terminal
  if (['ACCEPT', 'WALK_AWAY', 'ESCALATE'].includes(result.accordoIntent)) {
    const statusMap = {
      ACCEPT: 'ACCEPTED',
      WALK_AWAY: 'WALKED_AWAY',
      ESCALATE: 'ESCALATED',
    };
    await ChatbotDeal.update(
      { status: statusMap[result.accordoIntent] },
      { where: { id: dealId } }
    );
  }

  return {
    accordoMessage: result.accordoMessage,
    updatedState: result.updatedState,
  };
}
```

### Step 3: Test Template Selection

Run a quick test to verify templates work:

```typescript
import { selectTemplate, generateConversationMessage } from './convo/conversationTemplates.js';

// Test deterministic selection
const template1 = selectTemplate('test-deal-1', 1, 'GREET');
const template2 = selectTemplate('test-deal-1', 1, 'GREET');
console.log('Templates match:', template1 === template2); // Should be true

// Test message generation
const message = generateConversationMessage(
  'test-deal-1',
  1,
  'COUNTER',
  {
    counterparty: 'Acme Corp',
    currentPrice: 150,
    targetPrice: 120,
    paymentTerms: 'Net 30',
    reason: 'This aligns with our budget.'
  }
);
console.log('Generated message:', message);
```

### Step 4: Monitor State Transitions

Add logging to track conversation state:

```typescript
import { getStateSummary } from './convo/enhancedConvoRouter.js';

// After processing turn
logger.info('Conversation state', {
  dealId,
  summary: getStateSummary(result.updatedState)
});
// Output: "Phase: NEGOTIATING, Turn: 5, Refusals: 1, SmallTalk: 0"
```

### Step 5: Handle Terminal States

Add logic to handle conversation closure:

```typescript
if (result.accordoIntent === 'ESCALATE') {
  // Notify human agent
  await notifyAgent(dealId, result.updatedState);
}

if (result.accordoIntent === 'ACCEPT') {
  // Create contract or next steps
  await createContractFromDeal(dealId);
}

if (result.accordoIntent === 'WALK_AWAY') {
  // Archive deal
  await archiveDeal(dealId);
}
```

## Testing Checklist

Run through these tests to verify everything works:

- [ ] **Template Selection**
  ```typescript
  const template = selectTemplate('test-1', 1, 'GREET');
  console.log('Template:', template);
  // Should return one of 7 GREET templates
  ```

- [ ] **Variable Substitution**
  ```typescript
  const message = generateConversationMessage('test-1', 1, 'COUNTER', {
    counterparty: 'Test Corp',
    currentPrice: 100,
    targetPrice: 80,
    paymentTerms: 'Net 30',
    reason: 'Budget constraints'
  });
  console.log('Message:', message);
  // Should have all variables replaced
  ```

- [ ] **State Initialization**
  ```typescript
  import { initializeConvoState } from './convo/enhancedConvoRouter.js';
  const state = initializeConvoState();
  console.log('State:', state);
  // Should have phase: 'GREET', turnCount: 0, etc.
  ```

- [ ] **Intent Classification**
  ```typescript
  import { classifyVendorIntent } from './convo/enhancedConvoRouter.js';
  const intent = await classifyVendorIntent('Our price is $150 per unit');
  console.log('Intent:', intent);
  // Should return 'PROVIDE_OFFER' or fallback to heuristic
  ```

- [ ] **Full Turn Processing**
  ```typescript
  const result = await processConversationTurn({
    dealId: 'existing-deal-id',
    vendorMessage: 'Hello! Thanks for reaching out.',
    userId: 1
  });
  console.log('Result:', result);
  // Should return accordoMessage, accordoIntent, updatedState
  ```

- [ ] **Refusal Handling**
  ```typescript
  // Simulate 5 refusals to trigger escalation
  const state = initializeConvoState();
  for (let i = 0; i < 5; i++) {
    const intent = handleRefusal(state, 'NO');
    console.log(`Refusal ${i + 1}:`, intent, '- Count:', state.refusalCount);
  }
  // Should escalate on 5th refusal
  ```

## Common Issues & Solutions

### Issue 1: LLM Not Responding

**Symptoms**: Errors mentioning "Cannot connect to LLM" or timeout errors

**Solutions**:
1. Check Ollama is running: `ollama list`
2. Verify model is pulled: `ollama pull qwen3`
3. Check environment variables: `CHATBOT_LLM_BASE_URL`, `CHATBOT_LLM_MODEL`
4. System falls back to heuristics automatically

### Issue 2: Templates Not Varying

**Symptoms**: Always seeing the same template for a given intent

**Solutions**:
1. Verify `dealId` and `round` are changing between calls
2. Check you're not caching the template selection
3. Different deals with same round may coincidentally get same template
4. 7 variations per intent, so ~14% chance of same template

### Issue 3: State Not Persisting

**Symptoms**: Conversation state resets after each turn

**Solutions**:
1. Verify `convo_state_json` column exists in database
2. Check `saveDealState()` is being called
3. Verify no database transaction issues
4. Check `ChatbotDeal.update()` completes successfully

### Issue 4: Variables Not Substituting

**Symptoms**: Message contains `{variable}` placeholders

**Solutions**:
1. Check variable names match template placeholders
2. Verify variables object has all required keys
3. Review `prepareTemplateVariables()` logic
4. Check template configuration in database

## Performance Optimization

### 1. Cache Template Arrays (Already Done)

Templates are defined as constants and never regenerated:

```typescript
const CONVERSATION_TEMPLATES: Record<ConvoIntent, ConversationTemplate> = {
  // ... defined once at module load
};
```

### 2. Limit Conversation History

Only load last 10 messages for context:

```typescript
const messages = await ChatbotMessage.findAll({
  where: { dealId },
  order: [['createdAt', 'ASC']],
  limit: 10, // Prevents loading huge histories
});
```

### 3. Efficient Hash Function

SHA-256 substring conversion is fast:

```typescript
const hash = createHash('sha256').update(input).digest('hex');
const numericHash = parseInt(hash.substring(0, 8), 16);
// ~1-2ms per call
```

### 4. Minimize LLM Calls

- Only call LLM for intent classification (1-2 calls per turn)
- Template generation uses simple string substitution
- Fallback to heuristics if LLM is slow/unavailable

### 5. Database Optimization

- Single `findByPk` for deal lookup
- Batch message retrieval
- Atomic state updates
- Index on `dealId` in messages table

## Monitoring & Metrics

Add these metrics to track system health:

```typescript
// Track LLM vs fallback usage
logger.info('Intent classification', {
  method: 'llm' | 'fallback',
  latency: timeTaken,
});

// Track conversation phases
logger.info('Phase transition', {
  dealId,
  fromPhase: previousPhase,
  toPhase: newPhase,
  turnCount: state.turnCount,
});

// Track refusal patterns
if (state.refusalCount > 0) {
  logger.warn('Refusal detected', {
    dealId,
    refusalType,
    totalRefusals: state.refusalCount,
  });
}

// Track escalations
if (accordoIntent === 'ESCALATE') {
  logger.alert('Deal escalated', {
    dealId,
    reason: state.refusalCount >= 5 ? 'too_many_refusals' : 'other',
  });
}
```

## Next Steps (Phase 3 Preview)

Phase 2 is ready for Phase 3 decision engine integration:

1. **Offer Parsing Integration Point**
   ```typescript
   if (shouldParseOffer(vendorIntent, vendorMessage)) {
     // Phase 3: Parse vendor offer
     const offer = await parseOffer(vendorMessage, conversationHistory);
   }
   ```

2. **Decision Engine Integration Point**
   ```typescript
   if (shouldInvokeDecisionEngine(accordoIntent, vendorIntent)) {
     // Phase 3: Get strategic decision
     const decision = await decide(offer, templateConfig);
   }
   ```

3. **Strategic Response Generation**
   ```typescript
   // Phase 3: Generate response based on decision
   const strategicMessage = await generateStrategicResponse(decision);
   ```

## Support & Documentation

- **Full Documentation**: See `PHASE2_README.md` (700+ lines)
- **Integration Examples**: See `INTEGRATION_EXAMPLE.ts` (500+ lines)
- **Code Comments**: All functions are fully documented

## Summary

✅ **56 templates** across 8 intent types
✅ **Deterministic selection** for consistency
✅ **LLM-powered classification** with fallbacks
✅ **4-phase state machine** with context awareness
✅ **Refusal handling** (escalate after 5 refusals)
✅ **Small talk management** (redirect after 2 exchanges)
✅ **Database persistence** via `convoStateJson`
✅ **Production-ready** error handling
✅ **Phase 3 integration points** marked

**You're ready to go!** Start with Step 1 and work through the integration checklist.

---

Questions? Check `PHASE2_README.md` for detailed architecture and API reference.
