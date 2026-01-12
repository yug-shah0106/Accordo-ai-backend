# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Accordo is an AI-powered B2B procurement negotiation backend built with **TypeScript**, Node.js, Express, and PostgreSQL. It provides automated negotiation strategies, contract management, and vendor interactions using local LLM integration (Ollama).

**Important**: This codebase is **100% TypeScript**. All source files in `/src/` are `.ts` files. Migration files in `/migrations/` remain as `.cjs` for Sequelize CLI compatibility.

## Commands

```bash
# Development
npm run dev              # Start with ts-node-dev (auto-reload TypeScript)
npm run dev:clean        # Restart dev with clean state
npm run dev:kill         # Kill ts-node-dev processes

# Build & Production
npm run build            # Compile TypeScript to dist/
npm start                # Start server from compiled JavaScript (node dist/index.js)
npm run type-check       # Type check without emitting files

# Database
npm run migrate          # Run Sequelize migrations
npm run migrate:undo     # Undo last migration
npm run seed             # Run seed data

# Code Quality
npm run lint             # ESLint on src/**/*.ts
```

## TypeScript Architecture

### Build System
- **Development**: Uses `ts-node-dev` to run TypeScript directly with auto-reload
- **Production**: Compile with `npm run build` → outputs to `/dist/` → run with `npm start`
- **Type Safety**: Full TypeScript strict mode enabled
- **Module System**: ES Modules with `.js` extensions in imports (TypeScript convention)

### tsconfig.json Key Settings
- `module: "NodeNext"` - ES Modules support
- `outDir: "./dist"` - Compiled output directory
- `rootDir: "./src"` - Source directory
- `strict: true` - Full type safety
- Path aliases available: `@config/*`, `@models/*`, `@modules/*`, `@middlewares/*`, `@services/*`

## Architecture

### Module Pattern
Each feature module in `src/modules/` follows a consistent TypeScript structure:
- `*.controller.ts` - Express request handlers with typed Request/Response/NextFunction
- `*.service.ts` - Business logic layer with full type safety
- `*.repo.ts` - Database queries (when needed beyond ORM) with typed returns
- `*.routes.ts` - Express router definitions
- `*.validator.ts` - Joi validation schemas
- `index.ts` - Module exports (barrel pattern)

### Key Directories
- `src/models/` - **Sequelize TypeScript models** using `InferAttributes`, `InferCreationAttributes`
  - All associations defined in `index.ts`
  - Full type safety for model instances
- `src/middlewares/` - Typed middleware (auth, error handling, request logging, file upload)
  - `auth.middleware.ts` - JWT authentication with Request context augmentation
  - `error-handler.ts` - Global error handler with CustomError typing
- `src/services/` - Shared services with full TypeScript interfaces:
  - `llm.service.ts` - Ollama LLM integration with typed message interfaces
  - `email.service.ts` - Email notifications with retry logic (supports nodemailer and sendmail)
  - `chatbot.service.ts` - Integration with Accordo Chatbot API
  - `context.service.ts` - Context management for negotiations
- `src/config/` - TypeScript configuration modules:
  - `env.ts` - Environment variables with type-safe access
  - `database.ts` - Sequelize connection
  - `logger.ts` - Winston logger configuration
- `src/types/` - Shared TypeScript type definitions and interfaces
  - `express.d.ts` - Express module augmentation for custom Request properties
  - `index.ts` - Common types (PaginationParams, ApiResponse, UserType, etc.)
- `src/loaders/express.ts` - Express app configuration (cors, helmet, rate limiting)
- `migrations/` - Sequelize migration files (CommonJS format `.cjs` for CLI compatibility)

### Import Convention
**Important**: All imports in TypeScript files use `.js` extensions (not `.ts`):
```typescript
// Correct
import { User } from '../models/user.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

// Incorrect
import { User } from '../models/user.ts';  // ❌ Don't use .ts
import { User } from '../models/user';     // ❌ Extension required
```

This is the TypeScript/ES Modules convention - the `.js` extension refers to the *output* file.

### API Routes
All routes are prefixed with `/api`. Main routes:
- `/api/auth` - Authentication (JWT-based)
- `/api/negotiation` - AI-powered negotiation (BATNA calculation, MESO generation)
- `/api/requisition` - Purchase requisitions
- `/api/contract`, `/api/po` - Contracts and purchase orders
- `/api/chatbot` - **Negotiation Chatbot** (deal management, message processing, decision engine)
- `/api/vendor`, `/api/company`, `/api/customer` - Entity management
- `/api/chat` - Chat sessions with LLM integration
- `/api/benchmark` - Market benchmarking

### Data Models
Key entities: User, Company, VendorCompany, Product, Project, Requisition, Contract, Po, Negotiation, NegotiationRound, Preference, ChatSession.

**All models are TypeScript classes** extending Sequelize Model with full type inference:
```typescript
export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare email: string;
  // ... fully typed properties
}
```

## Configuration

Copy `.env.example` to `.env`. Key settings:
- `PORT=8000` (default)
- `DB_*` - PostgreSQL connection
- `JWT_*` - Authentication tokens
- `LLM_BASE_URL`, `LLM_MODEL` - Ollama configuration (default: llama3.2)
- **Email Configuration**:
  - `EMAIL_PROVIDER` - Email provider to use: 'nodemailer', 'sendmail', or leave blank for auto-detection
  - `SMTP_*` - SMTP configuration (host, port, user, pass, from) for nodemailer
  - `SENDMAIL_DEV_PORT` - Port for local SMTP testing with MailHog/Mailpit (default: 1025)
- `VENDOR_PORTAL_URL` - Frontend vendor portal URL (default: http://localhost:3000/vendor)
- `CHATBOT_FRONTEND_URL` - Chatbot frontend URL (default: http://localhost:5173)
- `CHATBOT_API_URL` - Chatbot backend API URL (default: http://localhost:4000/api)

Database auto-creates if it doesn't exist. Models auto-sync on startup.

### Email Provider Configuration

The email service supports two providers with automatic detection:

**Auto-Detection Logic**:
- If `EMAIL_PROVIDER` is explicitly set to 'nodemailer' or 'sendmail', use that provider
- If not set: Use nodemailer if `SMTP_HOST` is configured, otherwise use sendmail

**Nodemailer** (SMTP-based):
- Requires SMTP server configuration (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`)
- Best for production with services like Gmail, SendGrid, AWS SES
- Example: `EMAIL_PROVIDER=nodemailer`

**Sendmail** (System sendmail):
- Works without SMTP configuration
- In development mode, uses `devPort` to send to MailHog/Mailpit on localhost:1025
- In production, uses system's sendmail binary
- Best for local testing and simple deployments
- Example: `EMAIL_PROVIDER=sendmail`

**Local Testing with MailHog/Mailpit**:
```bash
# Run MailHog (captures emails for testing)
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog

# Set in .env
EMAIL_PROVIDER=sendmail
SENDMAIL_DEV_PORT=1025
NODE_ENV=development

# View emails at http://localhost:8025
```

### Vendor Email Notifications

When a vendor is attached to a requisition (Contract created):
1. A deal is automatically created in the Chatbot system via `chatbot.service.ts`
2. An email is sent to the vendor with requisition details and portal links
3. Email includes: requisition info, product list with target prices, due date, vendor portal link, chatbot link

On contract status changes, vendors receive status update emails automatically.

#### Email Service Architecture (`src/services/email.service.ts`)

**Provider Abstraction**: Supports two email providers with automatic detection:
- **Nodemailer**: SMTP-based email sending with full SMTP server support (Gmail, SendGrid, AWS SES)
- **Sendmail**: System sendmail binary with MailHog/Mailpit support for local testing

**Auto-Detection Logic**:
- If `EMAIL_PROVIDER` explicitly set to 'nodemailer' or 'sendmail', use that provider
- Else if `SMTP_HOST` is configured, use nodemailer
- Else use sendmail (default for local development)

**Retry Logic**: 3 attempts with exponential backoff (1s, 2s, 4s delays) for both providers.

**Provider Logging**: Logs which provider is being used on startup and per email sent.

**Local Development**: When using sendmail in development mode, emails are sent to MailHog (port 1025) for testing without requiring SMTP credentials.

**Email Types**:
- `vendor_attached` - Sent when a vendor is first attached to a requisition
- `status_change` - Sent when contract status changes (e.g., Opened, Accepted, Rejected)

**Skip Flags**: Pass `skipEmail: true` and/or `skipChatbot: true` in contract creation to bypass these features (useful for bulk imports or testing).

**HTML Templates** (`src/services/email-templates.ts`):
- Mobile-responsive design with product tables and CTA buttons
- Plain text fallback for email clients without HTML support
- Status badges with color-coded visual indicators

#### Email Audit Logging (`src/models/emailLog.ts`)

All sent emails are logged to the `EmailLogs` table for audit trail:
- `recipientEmail`, `recipientId` - Who received the email
- `subject`, `emailType` - What was sent
- `status` - pending | sent | failed | bounced
- `contractId`, `requisitionId` - Related entities
- `metadata` - JSON with context (oldStatus, newStatus, etc.)
- `errorMessage`, `retryCount` - Debugging info
- `messageId` - SMTP tracking ID

Query functions: `getEmailLogsForContract(contractId)`, `getEmailLogsForRecipient(email)`, `resendEmail(logId)`

#### Testing Email Locally with MailHog

**Setup**:
```bash
# Run MailHog via Docker
docker run -d --name mailhog -p 1025:1025 -p 8025:8025 mailhog/mailhog

# Configure .env
EMAIL_PROVIDER=sendmail
SENDMAIL_DEV_PORT=1025
NODE_ENV=development

# Start backend
npm run dev
```

**Verify**:
- Server logs show: `Email service initialized with provider: sendmail`
- Create contract or update status to trigger emails
- View captured emails at http://localhost:8025
- Check EmailLogs table for audit trail

**Stop MailHog**:
```bash
docker stop mailhog && docker rm mailhog
```

#### Chatbot Integration (`src/services/chatbot.service.ts`)

Creates deals in the Accordo Chatbot system:
- Deal title format: `{ProjectName} - {RequisitionTitle}`
- Returns deal UUID stored in `Contract.chatbotDealId`
- Email links to chatbot: `{CHATBOT_FRONTEND_URL}/conversation/deals/{dealId}`

## Technical Notes

### TypeScript Specific
- **100% TypeScript codebase** - All source files are `.ts`
- **Strict mode enabled** - Full type safety enforcement
- **ES Modules** - `"type": "module"` in package.json with `.js` import extensions
- **Type definitions** - All Express types augmented in `src/types/express.d.ts`
- **Sequelize TypeScript** - Full type inference for models and queries

### Build & Deployment
- Development runs TypeScript directly via `ts-node-dev`
- Production requires compilation: `npm run build` → `dist/` folder
- Compiled output is standard ES Modules JavaScript
- Source maps included for debugging

### Other
- **Migrations**: Use CommonJS (`.cjs` extension) for sequelize-cli compatibility
- **Server Protection**: Uses `toobusy-js` for load protection (returns 503 when overloaded)
- **File Uploads**: Handled via multer middleware with TypeScript types
- **Logging**: Winston logger with daily rotate file support and typed log levels

### Request Context
The `Request` object is augmented with a `context` property:
```typescript
interface Request {
  context: {
    userId: number;
    userType: 'admin' | 'customer' | 'vendor';
    companyId?: number;
  };
  user?: User;
}
```

This is set by the `authMiddleware` after JWT verification.

## Negotiation Chatbot System

### Overview
The Negotiation Chatbot is a utility-based AI decision engine for procurement negotiations. It operates in two modes:
- **INSIGHTS Mode** (Demo): Deterministic decision engine with utility scoring
- **CONVERSATION Mode**: LLM-driven conversational negotiation (future enhancement)

### Architecture (`src/modules/chatbot/`)

**Key Files**:
- `chatbot.service.ts` - Core business logic for deal management and message processing
- `chatbot.controller.ts` - Express route handlers for chatbot endpoints
- `chatbot.routes.ts` - API route definitions
- `vendor/vendorAgent.ts` - Vendor negotiation agent with decision-making logic
- `vendor/vendorPolicy.ts` - Utility calculation and negotiation policies
- `vendor/vendorSimulator.service.ts` - Simulated vendor responses for testing

### Message Processing Flow (INSIGHTS Mode)

When a vendor message is received:

1. **Extract Offer** - Parse vendor message to extract structured offer (price, terms)
2. **Calculate Utilities** - Compute utility scores for price and payment terms
3. **Make Decision** - Determine action (ACCEPT, COUNTER, WALK_AWAY, ESCALATE, ASK_CLARIFY)
4. **Generate Counter-Offer** - Create Accordo's counter-proposal using concession strategy
5. **Save Messages** - Store VENDOR message and auto-generated ACCORDO response
6. **Return Full Context** - Send updated deal and all messages to frontend

### Auto-Response Generation (`generateAccordoResponseText`)

The system now automatically generates contextual Accordo responses based on decisions:

**ACCEPT**:
- Confirms agreement with final terms
- Example: "I'm pleased to accept your offer. We have a deal at $95.00 with Net 30 payment terms."

**COUNTER**:
- Proposes counter-offer with reasoning
- Includes utility score for transparency
- Example: "Thank you for your offer. Based on our analysis, I'd like to counter with $92.50 and Net 60 payment terms. This would give us a utility score of 78%."

**WALK_AWAY**:
- Explains why offer is unacceptable
- References utility threshold
- Example: "I appreciate your time, but unfortunately the current offer doesn't meet our minimum requirements. The utility score of 45% falls below our walkaway threshold."

**ESCALATE**:
- Indicates human review needed
- Example: "This negotiation has reached a point where I need to escalate it to a human decision-maker for review."

**ASK_CLARIFY**:
- Requests additional information
- Example: "I need some clarification on your offer. Could you please provide more details about the pricing and payment terms?"

### API Response Format Changes (January 2026)

**POST `/api/chatbot/deals/:dealId/messages`** (Process Vendor Message):
```typescript
// Response includes full deal context for frontend state sync
{
  message: "Message processed successfully",
  data: {
    deal: Deal,              // Updated deal with new status/round
    messages: Message[],     // ALL messages for this deal
    latestMessage: Message,  // The vendor message just created
    decision: Decision,      // Engine decision (action, utilityScore, counterOffer)
    explainability: Explainability  // Detailed utility breakdown
  }
}
```

**POST `/api/chatbot/deals/:dealId/reset`**:
```typescript
// Returns empty messages array after reset
{
  message: "Deal reset successfully",
  data: {
    deal: Deal,       // Reset deal (round 0, status NEGOTIATING)
    messages: []      // Empty array (all messages deleted)
  }
}
```

**GET `/api/chatbot/deals/:dealId/config`**:
```typescript
// Config now wrapped in data object for consistency
{
  message: "Config retrieved successfully",
  data: {
    config: NegotiationConfig
  }
}
```

### Frontend Integration Benefits

These changes enable the frontend to:
1. **Eliminate Extra API Calls** - Get full deal state in single response
2. **Maintain Sync** - Receive all messages including auto-generated Accordo responses
3. **Show Live Updates** - Display Accordo's reasoning in real-time
4. **Reduce Complexity** - No need to manually fetch messages after processing

### Database Schema

**ChatbotMessage Model** (`src/models/chatbotMessage.ts`):
- `role`: VENDOR | ACCORDO | SYSTEM
- `content`: Message text (vendor input or auto-generated Accordo response)
- `extractedOffer`: Parsed offer from vendor message (price, terms)
- `engineDecision`: Full Decision object (only for ACCORDO messages)
- `decisionAction`: Quick access to action (ACCEPT, COUNTER, etc.)
- `utilityScore`: Overall utility score (0-1)
- `counterOffer`: Accordo's counter-proposal (only for ACCORDO messages)
- `explainabilityJson`: Detailed utility breakdown and reasoning

**Key Change**: ACCORDO messages are now created automatically by the system with pre-generated content, rather than relying on frontend to display raw decision data.

### Training Data Logging System (January 2026)

**Purpose**: Capture AI-generated scenario suggestions for future LLM fine-tuning and performance analysis.

**Database Table** (`negotiation_training_data`):
- `id`: Primary key (serial)
- `deal_id`: Foreign key to `chatbot_deals` (UUID)
- `user_id`: User who requested suggestions (INTEGER)
- `round`: Negotiation round when suggestions were generated (INTEGER)
- `suggestions_json`: Generated suggestions for all scenarios (JSONB)
  - Format: `{ "HARD": [...], "MEDIUM": [...], "SOFT": [...], "WALK_AWAY": [...] }`
- `conversation_context`: Conversation history at time of generation (TEXT)
- `config_snapshot`: Negotiation config snapshot (JSONB)
- `llm_model`: LLM model used (VARCHAR, e.g., 'llama3.2')
- `generation_source`: 'llm' or 'fallback' (ENUM)
- `selected_scenario`: Scenario selected by user (VARCHAR, nullable)
- `selected_suggestion`: Specific suggestion text selected (TEXT, nullable)
- `deal_outcome`: Final deal outcome (VARCHAR, nullable)
- `created_at`, `updated_at`: Timestamps

**Indexes**:
- `idx_training_data_deal_id` - For deal-based queries
- `idx_training_data_user_id` - For user-based queries
- `idx_training_data_created_at` - For time-based queries
- `idx_training_data_generation_source` - For filtering by source

**Model** (`src/models/negotiationTrainingData.ts`):
- TypeScript Sequelize model with full type safety
- Association: `belongsTo(ChatbotDeal, { foreignKey: 'dealId', as: 'Deal' })`

**Service Integration** (`src/modules/chatbot/chatbot.service.ts`):
- `generateScenarioSuggestionsService()` function (line 936-1101)
- Automatically logs training data after generating suggestions (lines 1065-1086)
- Non-blocking: Logging failures don't break the endpoint
- Captures: suggestions, context, config, model, and generation source

**API Endpoint**:
- `POST /api/chatbot/deals/:dealId/suggest-counters`
- Generates 4 suggestions per scenario (HARD, MEDIUM, SOFT, WALK_AWAY)
- Requires: Deal with negotiation config
- Returns: `Record<string, string[]>` (scenario → suggestions mapping)

**Use Cases**:
1. **LLM Fine-tuning**: Build dataset of successful negotiation suggestions
2. **Performance Analysis**: Compare LLM vs fallback suggestion quality
3. **User Behavior**: Track which scenarios and suggestions users select
4. **Outcome Correlation**: Analyze which suggestions lead to successful deals
5. **Model Comparison**: A/B test different LLM models

## Vector & RAG System (January 2026)

### Overview

The Vector module provides semantic search, RAG (Retrieval-Augmented Generation), and vectorization capabilities for the negotiation system. It uses HuggingFace's `BAAI/bge-large-en-v1.5` model (1024 dimensions) for embeddings and PostgreSQL with in-memory vector storage.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Accordo Backend (Node.js)                │
└─────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
         ▼            ▼            ▼
   Real-time      Batch Job    Query Service
   Queue          (Migration)  (RAG/Search)
         │            │            │
         └────────────┼────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  Python Embedding      │
         │  Microservice (8001)   │
         │  (bge-large-en-v1.5)   │
         └────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  PostgreSQL + Arrays   │
         │  (Vector Storage)      │
         └────────────────────────┘
```

### Key Components

**Module Location**: `src/modules/vector/`

**Files**:
- `vector.types.ts` - TypeScript interfaces for all vector operations
- `embedding.client.ts` - HTTP client for Python embedding service
- `vector.service.ts` - Core vectorization, search, and RAG logic
- `vector.controller.ts` - Express route handlers
- `vector.routes.ts` - API route definitions
- `vectorization.queue.ts` - In-memory queue for real-time processing
- `migration.job.ts` - Batch migration for historical data
- `index.ts` - Module exports

**Models** (`src/models/`):
- `messageEmbedding.ts` - Embeddings for individual messages
- `dealEmbedding.ts` - Embeddings for deal summaries
- `negotiationPattern.ts` - Learned negotiation patterns
- `vectorMigrationStatus.ts` - Migration progress tracking

### Python Embedding Microservice

**Location**: `embedding-service/`

**Files**:
- `main.py` - FastAPI application
- `requirements.txt` - Python dependencies
- `Dockerfile` - Container configuration
- `README.md` - Service documentation

**Endpoints**:
- `GET /health` - Health check with GPU/device info
- `POST /embed` - Single text embedding
- `POST /embed/batch` - Batch embeddings (up to 100)
- `POST /similarity` - Compute cosine similarity

**Running the Service**:
```bash
cd embedding-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py  # Runs on port 8001
```

Or with Docker:
```bash
docker build -t accordo-embedding-service .
docker run -p 8001:8001 accordo-embedding-service
```

### API Endpoints (`/api/vector`)

**Search Endpoints**:
- `POST /search/messages` - Find similar negotiation messages
- `POST /search/deals` - Find similar completed deals
- `POST /search/patterns` - Find relevant negotiation patterns

**RAG Endpoints**:
- `POST /context/:dealId` - Build AI context for a deal
- `POST /rag/:dealId` - Get RAG context for system prompt augmentation

**Embedding Endpoints**:
- `POST /embed/message/:messageId` - Manually vectorize a message
- `POST /embed/deal/:dealId` - Manually vectorize a deal

**Migration Endpoints**:
- `POST /migrate` - Start historical data migration
- `GET /migrate/status` - Get migration progress
- `POST /migrate/cancel` - Cancel running migration

**Statistics**:
- `GET /health` - Embedding service health
- `GET /stats` - Vector database statistics

### Configuration

**Environment Variables**:
```bash
# Embedding Service
EMBEDDING_SERVICE_URL=http://localhost:8001
EMBEDDING_MODEL=BAAI/bge-large-en-v1.5
EMBEDDING_DIMENSION=1024
EMBEDDING_TIMEOUT=30000

# Vector Search
VECTOR_DEFAULT_TOP_K=5
VECTOR_SIMILARITY_THRESHOLD=0.7

# Processing
ENABLE_REALTIME_VECTORIZATION=true
VECTOR_MIGRATION_BATCH_SIZE=100
```

### Data Flow

**Real-Time Vectorization**:
1. Message created in chatbot
2. `onMessageCreated()` hook enqueues vectorization task
3. Queue processes task asynchronously
4. Embedding generated via Python service
5. Stored in `message_embeddings` table
6. Deal embeddings updated on completion

**RAG Context Building**:
1. Vendor sends message
2. `buildRAGContext()` called
3. Query embedded and searched against:
   - Similar successful deals
   - Relevant negotiation patterns
   - Past Accordo responses
4. Context injected into LLM system prompt
5. Enhanced response generated

### Database Schema

**message_embeddings**:
- `id` (UUID) - Primary key
- `message_id` (UUID) - FK to chatbot_messages
- `deal_id` (UUID) - FK to chatbot_deals
- `embedding` (FLOAT[]) - 1024-dimensional vector
- `content_text` (TEXT) - Original embedded text
- `content_type` (ENUM) - message | offer_extract | decision
- `role` (ENUM) - VENDOR | ACCORDO | SYSTEM
- `outcome`, `utility_score`, `decision_action` - Metadata
- Indexed on: deal_id, message_id, role, outcome, created_at

**deal_embeddings**:
- `id` (UUID) - Primary key
- `deal_id` (UUID) - FK to chatbot_deals
- `embedding` (FLOAT[]) - 1024-dimensional vector
- `embedding_type` (ENUM) - summary | pattern | outcome
- `final_status`, `total_rounds`, `final_utility` - Deal metrics
- `anchor_price`, `target_price`, `final_price` - Pricing data
- Indexed on: deal_id, embedding_type, final_status, final_utility

**negotiation_patterns**:
- `id` (UUID) - Primary key
- `embedding` (FLOAT[]) - Pattern vector
- `pattern_type` (ENUM) - successful_negotiation | failed_negotiation | etc.
- `pattern_name` (STRING) - Human-readable name
- `avg_utility`, `success_rate`, `sample_count` - Statistics
- `example_deal_ids` (UUID[]) - Reference deals
- `is_active` (BOOLEAN) - Pattern status

**vector_migration_status**:
- Tracks batch migration progress
- Fields: status, total_records, processed_records, failed_records
- Processing rate and estimated time remaining

### Usage Examples

**Search Similar Messages**:
```typescript
import { vectorService } from './modules/vector/index.js';

const results = await vectorService.searchSimilarMessages(
  "I can offer $95 per unit with Net 60 terms",
  {
    topK: 5,
    similarityThreshold: 0.7,
    filters: {
      role: 'ACCORDO',
      decisionAction: 'COUNTER'
    }
  }
);
```

**Build RAG Context**:
```typescript
const ragContext = await vectorService.buildRAGContext(
  dealId,
  "The vendor is offering $100 with Net 30 terms"
);

// Use in LLM prompt
const enhancedPrompt = `${systemPrompt}${ragContext.systemPromptAddition}`;
```

**Manual Vectorization**:
```typescript
import { onMessageCreated, onDealCompleted } from './modules/vector/index.js';

// After message creation
await onMessageCreated(message, deal);

// After deal completion
await onDealCompleted(dealId);
```

### Integration with Chatbot

The vector module integrates with the chatbot service to:

1. **Enhance Responses**: RAG context provides relevant past negotiations
2. **Track Patterns**: Successful negotiations are analyzed for patterns
3. **Improve Suggestions**: Similar scenarios inform counter-offer generation
4. **Train Models**: Vectorized data feeds future model fine-tuning

**Hook Integration** (add to chatbot.service.ts):
```typescript
import { onMessageCreated, onDealCompleted } from '../vector/index.js';

// After creating a message
await onMessageCreated(newMessage, deal);

// After deal status changes to ACCEPTED/WALKED_AWAY
if (deal.status !== 'NEGOTIATING') {
  await onDealCompleted(deal.id);
}
```

### Performance Considerations

- **Embedding latency**: ~10-50ms (GPU) / ~100-300ms (CPU)
- **Batch processing**: Up to 100 texts per request
- **Search latency**: <100ms with in-memory similarity computation
- **Migration rate**: ~10-50 records/second depending on hardware

### Troubleshooting

**Embedding service not available**:
```bash
# Check if Python service is running
curl http://localhost:8001/health

# Check logs
cd embedding-service && python main.py
```

**Slow search performance**:
- Reduce `topK` parameter
- Add more specific filters
- Consider implementing HNSW index for large datasets

**Migration failures**:
- Check `vector_migration_status` table for errors
- Resume failed migrations with `resumeMigration(id)`
- Reduce batch size if memory issues

## Vendor Bid Comparison System (January 2026)

### Overview

The Bid Comparison System tracks multiple vendor negotiations per requisition, compares final offers, generates PDF reports with charts, and enables procurement owners to select winning vendors with full audit trail.

### Architecture (`src/modules/bidComparison/`)

**Key Files**:
- `bidComparison.service.ts` - Core business logic for bid capture, comparison, and selection
- `bidComparison.controller.ts` - Express route handlers for comparison endpoints
- `bidComparison.routes.ts` - API route definitions
- `bidComparison.validator.ts` - Request validation schemas
- `bidComparison.types.ts` - TypeScript interfaces
- `pdf/pdfGenerator.ts` - PDFKit-based report generation with bar charts
- `pdf/chartRenderer.ts` - Horizontal bar chart rendering
- `summary/summaryGenerator.ts` - LLM-generated negotiation summaries
- `scheduler/deadlineChecker.ts` - Cron job for deadline-triggered comparisons

### Database Models

**VendorBid** (`vendor_bids` table):
Stores final bid information from completed vendor negotiations.
- `id` (UUID) - Primary key
- `requisitionId` (INTEGER) - FK to Requisitions
- `contractId` (INTEGER) - FK to Contracts
- `dealId` (UUID) - FK to chatbot_deals
- `vendorId` (INTEGER) - FK to Users
- `finalPrice` (DECIMAL) - Final negotiated total price
- `unitPrice` (DECIMAL) - Final negotiated unit price
- `paymentTerms` (STRING) - Payment terms (e.g., "Net 30")
- `deliveryDate` (DATE) - Promised delivery date
- `utilityScore` (DECIMAL) - Final utility score (0-1)
- `bidStatus` (ENUM) - PENDING | COMPLETED | EXCLUDED | SELECTED | REJECTED
- `dealStatus` (ENUM) - NEGOTIATING | ACCEPTED | WALKED_AWAY | ESCALATED
- `chatSummaryMetrics` (JSONB) - Structured metrics from negotiation
- `chatSummaryNarrative` (TEXT) - LLM-generated narrative summary
- `chatLink` (STRING) - URL to view full chat history
- Indexes: requisition_id, vendor_id, bid_status, final_price, deal_id, contract_id

**BidComparison** (`bid_comparisons` table):
Tracks comparison reports sent to procurement owners.
- `id` (UUID) - Primary key
- `requisitionId` (INTEGER) - FK to Requisitions
- `triggeredBy` (ENUM) - ALL_COMPLETED | DEADLINE_REACHED | MANUAL
- `totalVendors` (INTEGER) - Total vendors attached to requisition
- `completedVendors` (INTEGER) - Vendors who completed negotiations
- `excludedVendors` (INTEGER) - Vendors excluded (walked away)
- `topBidsJson` (JSONB) - Array of top bids with vendor details
- `pdfUrl` (STRING) - Path to generated PDF report
- `sentToUserId` (INTEGER) - FK to Users (procurement owner)
- `sentToEmail` (STRING) - Email address comparison was sent to
- `emailStatus` (ENUM) - PENDING | SENT | FAILED
- `emailLogId` (INTEGER) - FK to EmailLogs for audit
- Indexes: requisition_id, triggered_by, generated_at, email_status

**VendorSelection** (`vendor_selections` table):
Full audit trail for vendor selection decisions.
- `id` (UUID) - Primary key
- `requisitionId` (INTEGER) - FK to Requisitions
- `comparisonId` (UUID) - FK to bid_comparisons
- `selectedVendorId` (INTEGER) - FK to Users (winning vendor)
- `selectedBidId` (UUID) - FK to vendor_bids
- `selectedPrice` (DECIMAL) - Final price of selected bid
- `selectedByUserId` (INTEGER) - FK to Users (decision maker)
- `selectionReason` (TEXT) - Optional reason for selection
- `selectionMethod` (ENUM) - EMAIL_LINK | PORTAL | API
- `poId` (INTEGER) - FK to Pos (auto-generated PO)
- Indexes: requisition_id (unique), selected_vendor_id, selected_by_user_id, selected_at

**VendorNotification** (`vendor_notifications` table):
Track post-selection notifications to all vendors.
- `id` (UUID) - Primary key
- `selectionId` (UUID) - FK to vendor_selections
- `vendorId` (INTEGER) - FK to Users
- `bidId` (UUID) - FK to vendor_bids
- `notificationType` (ENUM) - SELECTION_WON | SELECTION_LOST
- `emailLogId` (INTEGER) - FK to EmailLogs
- `emailStatus` (ENUM) - PENDING | SENT | FAILED
- Indexes: selection_id, vendor_id, notification_type, email_status

### API Endpoints (`/api/bid-comparison`)

**Comparison Operations**:
- `GET /:requisitionId` - Get comparison status for a requisition
- `GET /:requisitionId/bids` - List all bids for a requisition
- `GET /:requisitionId/pdf` - Download comparison PDF report
- `POST /:requisitionId/generate` - Manually trigger comparison generation

**Selection Operations**:
- `POST /:requisitionId/select/:bidId` - Select winning vendor
- `GET /:requisitionId/selection` - Get selection details

### Trigger Mechanisms

**Automatic Triggers**:
1. **All Vendors Complete**: When all attached vendors complete negotiations (ACCEPTED, WALKED_AWAY, or ESCALATED), comparison is automatically generated
2. **Deadline Reached**: Hourly cron job checks `negotiationClosureDate` and triggers comparison for expired requisitions

**Manual Trigger**:
- Procurement owner can manually request comparison via `POST /api/bid-comparison/:requisitionId/generate`

### PDF Report Generation

**PDFKit Features**:
- Header with requisition details (title, company, date)
- Horizontal bar chart comparing vendor prices (lowest to highest)
- Color-coded bars (top 3 highlighted in different colors)
- Detailed table with: Vendor name, Final price, Unit price, Payment terms, Delivery date, Utility score, Chat summary link
- Footer with generation timestamp

**Chart Configuration**:
- Y-axis: Vendor names
- X-axis: Price scale
- Colors: Gold (#FFD700) for rank 1, Silver (#C0C0C0) for rank 2, Bronze (#CD7F32) for rank 3

### Post-Selection Workflow

When a vendor is selected:
1. **Create VendorSelection record** with full audit details
2. **Update requisition status** to 'Awarded'
3. **Auto-generate Purchase Order** for selected vendor
4. **Send WIN notification** to selected vendor
5. **Send LOST notifications** to all other participating vendors
6. **Update bid statuses** - SELECTED for winner, REJECTED for others

### Email Templates

**Comparison Email** (sent to procurement owner):
- Summary table with top bids
- Quick approve buttons (links to selection endpoint)
- PDF attachment with full comparison
- Link to detailed portal view

**Win/Loss Notifications** (sent to vendors):
- Clear outcome message
- Deal summary (price, terms)
- Next steps for winning vendor (PO details)
- Professional closure for losing vendors

### Integration with Chatbot

**Hook Integration** (`chatbot.service.ts`):
```typescript
// After deal status changes to terminal state
if (['ACCEPTED', 'WALKED_AWAY', 'ESCALATED'].includes(finalStatus)) {
  await bidComparisonService.captureVendorBid(deal.id);
  await bidComparisonService.checkAndTriggerComparison(deal.requisitionId);
}
```

**Bid Capture**:
- Extracts final offer details from completed deal
- Generates chat summary (metrics + LLM narrative)
- Creates VendorBid record linked to deal

### Configuration

**Environment Variables**:
```bash
# PDF Storage
PDF_STORAGE_PATH=./uploads/pdfs
PDF_BASE_URL=http://localhost:8000/pdfs

# Scheduler
ENABLE_DEADLINE_SCHEDULER=true
DEADLINE_CHECK_INTERVAL=0 * * * *  # Every hour (cron expression)
```

### Dependencies

- `pdfkit` (^0.16.0) - PDF generation
- `node-cron` (^3.0.3) - Deadline scheduling

### Technical Notes

**Sequelize ENUM Bug Workaround**:
ENUM fields in the 4 new models do not include `comment` properties due to a Sequelize bug that generates invalid SQL when altering ENUM columns with comments:
```sql
-- Bug produces invalid SQL with USING after COMMENT
ALTER TABLE ... ALTER COLUMN ... TYPE enum  ; COMMENT ON COLUMN ... USING (cast);
```
Solution: Removed `comment` property from all ENUM field definitions in vendorBid.ts, bidComparison.ts, vendorSelection.ts, and vendorNotification.ts.

**Index Field Naming**:
With `underscored: true` option, index fields use snake_case (database column names):
```typescript
indexes: [
  { fields: ['requisition_id'] },  // Correct (snake_case)
  { fields: ['requisitionId'] },   // Wrong (would cause "column not found")
]
```
