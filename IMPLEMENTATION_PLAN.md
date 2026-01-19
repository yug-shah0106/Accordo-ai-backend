# Implementation Plan: LLM Performance Optimization & Model Consistency

## Overview
This plan addresses two issues:
1. **LLM Response Speed**: Vendor suggestions/messages taking too long (target: under 1 second)
2. **Model Consistency**: Ensure llama3.1 is used everywhere instead of llama3.2

---

## Phase 1: Fix Model Consistency (llama3.2 → llama3.1)

### Files to Update:

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `src/config/env.ts` | 139 | `'llama3.2'` | `'llama3.1'` |
| `src/modules/chatbot/chatbot.service.ts` | 1712 | `'llama3.2'` | `'llama3.1'` |
| `src/seeders/data/trainingData.ts` | 176 | `'llama3.2'` | `'llama3.1'` |
| `src/modules/health/health.routes.ts` | 68 | `llama3.2` (comment) | `llama3.1` |

### Impact:
- All LLM calls will consistently use llama3.1
- No functional changes, just default model alignment

---

## Phase 2: Optimize LLM Response Speed

### Current State Analysis:
- **chatbotLlamaClient.ts**: 60-second timeout, 500 maxTokens default
- **vendorAgent.ts**: Uses 150 maxTokens, 0.8 temperature
- **Problem**: LLM inference on llama3.1 (~8B params) can be slow

### Optimization Strategy:

#### A. Reduce Token Generation (Backend)
1. **Lower maxTokens**: 150 → 80 for vendor messages (messages are 2-3 sentences)
2. **Reduce temperature**: 0.8 → 0.6 (less randomness = faster convergence)
3. **Add `num_ctx` limit**: Reduce context window to 2048 (faster processing)

#### B. Implement Response Streaming (Backend + Frontend)
1. **Backend**: Enable SSE (Server-Sent Events) streaming for LLM responses
2. **Frontend**: Display message character-by-character as it generates
3. **Benefit**: Perceived instant response (user sees text appearing immediately)

#### C. Fallback to Templates (Backend)
1. If LLM response takes > 3 seconds, immediately fallback to template
2. Template responses are pre-calculated (< 1ms)
3. Already partially implemented in `vendorAgent.ts`

#### D. Parallel Pre-generation (Optional - Advanced)
1. Pre-generate next likely vendor responses in background
2. Cache responses for common scenarios
3. Serve cached response if available

### Implementation Details:

#### Backend Changes:

**File: `src/modules/chatbot/llm/chatbotLlamaClient.ts`**
```typescript
// Reduce defaults for faster generation
const DEFAULT_MAX_TOKENS = 80;  // Was 500
const DEFAULT_TEMPERATURE = 0.6;  // Was 0.7
const DEFAULT_NUM_CTX = 2048;  // Add context limit
const FAST_TIMEOUT = 5000;  // 5 second timeout (was 60s)

// Add streaming support
export async function streamChatbotLlamaCompletion(
  systemPrompt: string,
  conversationHistory: Array<{ role: string; content: string }>,
  onChunk: (chunk: string) => void,
  options: CompletionOptions = {}
): Promise<string> {
  // Implementation with stream: true
}
```

**File: `src/modules/chatbot/vendor/vendorAgent.ts`**
```typescript
// Tighter timeout with fast fallback
const LLM_TIMEOUT_MS = 3000;  // 3 second hard limit

// Wrap LLM call with timeout
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('LLM timeout')), LLM_TIMEOUT_MS)
);

const vendorMessage = await Promise.race([
  generateChatbotLlamaCompletion(...),
  timeoutPromise
]).catch(() => {
  // Fallback to template
  return buildFallbackVendorMessage(round, nextPrice, nextTerms, scenario);
});
```

#### Frontend Changes:

**Add Loading State:**
- Show typing indicator/skeleton while waiting for response
- Animate text appearance for streaming responses

---

## Phase 3: Add Loading UI (Frontend)

### Components to Update:
1. **NegotiationChat.tsx** (or equivalent chat component)
   - Add "typing indicator" when waiting for AI response
   - Show skeleton/shimmer while loading

2. **Message Component**
   - Support streaming text display
   - Animate message appearance

### Implementation:
```tsx
// Typing indicator component
const TypingIndicator = () => (
  <div className="flex items-center gap-1 p-3">
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

// Usage in chat
{isLoading && <TypingIndicator />}
```

---

## Execution Order

1. **Phase 1** (5 min): Fix model consistency - update 4 files
2. **Phase 2A** (15 min): Reduce token limits and add timeout fallback
3. **Phase 2B** (30 min): Add SSE streaming support (optional, for best UX)
4. **Phase 3** (20 min): Add loading UI in frontend

---

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Avg response time | 5-15 seconds | < 3 seconds (with fallback < 1s) |
| Perceived response | Blank wait | Immediate typing indicator |
| User experience | Frustrating | Responsive |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Lower token limit truncates messages | Messages are 2-3 sentences, 80 tokens is sufficient |
| Streaming adds complexity | Can skip streaming, just add loading UI |
| Template fallback feels "robotic" | Templates are well-written, acceptable quality |

---

## Questions Resolved

- **Model to use**: llama3.1 everywhere
- **Speed target**: Under 1 second (with fallback)
- **Approach**: Optimize LLM + fast fallback + loading UI
- **Streaming**: Will add SSE streaming for progressive display
