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
npm run seed:comprehensive  # Run comprehensive seed with test scenarios

# Code Quality
npm run lint             # ESLint on src/**/*.ts
```

## TypeScript Architecture

### Build System
- **Development**: Uses `ts-node-dev` to run TypeScript directly with auto-reload
- **Production**: Compile with `npm run build` -> outputs to `/dist/` -> run with `npm start`
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
- `*.validator.ts` - Joi/Zod validation schemas
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
- `src/seeders/` - Database seeding scripts
  - `index.ts` - Main seeder with development data
  - `comprehensiveSeed.ts` - Comprehensive seeder for testing scenarios
  - `data/` - Static data files
  - `helpers/` - Seeder utility functions
- `migrations/` - Sequelize migration files (CommonJS format `.cjs` for CLI compatibility)

### Import Convention
**Important**: All imports in TypeScript files use `.js` extensions (not `.ts`):
```typescript
// Correct
import { User } from '../models/user.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

// Incorrect
import { User } from '../models/user.ts';  // Don't use .ts
import { User } from '../models/user';     // Extension required
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
- `/api/health` - Service health monitoring

### Data Models
Key entities: User, Company, VendorCompany, Product, Project, Requisition, Contract, Po, Negotiation, NegotiationRound, Preference, ChatSession, Address.

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
- `PORT=5002` (default) - Backend API server port
- `DB_*` - PostgreSQL connection
- `JWT_*` - Authentication tokens
- `LLM_BASE_URL`, `LLM_MODEL` - Ollama configuration (default: llama3.2)
- **Email Configuration**:
  - `EMAIL_PROVIDER` - Email provider to use: 'nodemailer', 'sendmail', or leave blank for auto-detection
  - `SMTP_*` - SMTP configuration (host, port, user, pass, from) for nodemailer
  - `SENDMAIL_DEV_PORT` - Port for local SMTP testing with MailHog/Mailpit (default: 5004)
  - `MAILHOG_WEB_PORT` - MailHog web UI port (default: 5005)
- `VENDOR_PORTAL_URL` - Frontend vendor portal URL (default: http://localhost:5001/vendor)
- `CHATBOT_FRONTEND_URL` - Chatbot frontend URL (default: http://localhost:5001)
- `CHATBOT_API_URL` - Chatbot backend API URL (default: http://localhost:5002/api)
- `EMBEDDING_SERVICE_URL` - Python embedding service URL (default: http://localhost:5003)

Database auto-creates if it doesn't exist. Models auto-sync on startup.

### Port Configuration (January 2026)

All services are configured to run on sequential ports starting from 5001:

> **Note**: Port 5000 is reserved by macOS AirPlay Receiver. Frontend uses port 5001.

| Service | Port | Environment Variable | Description |
|---------|------|---------------------|-------------|
| Frontend | 5001 | `VITE_DEV_PORT` | React/Vite frontend application |
| Backend API | 5002 | `PORT` | Express.js backend server |
| Embedding Service | 5003 | `EMBEDDING_SERVICE_PORT` | Python FastAPI embedding service |
| MailHog SMTP | 5004 | `SENDMAIL_DEV_PORT` | Email testing SMTP server |
| MailHog Web UI | 5005 | `MAILHOG_WEB_PORT` | Email testing web interface |

**External Services (unchanged):**
| Service | Port | Notes |
|---------|------|-------|
| PostgreSQL | 5432 | Standard PostgreSQL port |
| Redis | 6379 | Standard Redis port |
| Ollama LLM | 11434 | Standard Ollama port |

**Starting Services:**
```bash
# Start MailHog with new ports
docker run -d -p 5004:1025 -p 5005:8025 mailhog/mailhog

# Start embedding service (runs on 5003)
cd embedding-service && python main.py

# Start backend (runs on 5002)
npm run dev

# Frontend (separate repo - runs on port 5001)
cd ../Accordo-ai-frontend && npm run dev
```

**Frontend Configuration:**
For the frontend (separate repository), update `.env.local`:
```bash
VITE_BACKEND_URL=http://localhost:5002
VITE_FRONTEND_URL=http://localhost:5001
VITE_ASSEST_URL=http://localhost:5002
VITE_DEV_PORT=5001
```

The frontend uses `VITE_DEV_PORT` environment variable for port configuration.

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
- In development mode, uses `devPort` to send to MailHog/Mailpit on localhost:5004
- In production, uses system's sendmail binary
- Best for local testing and simple deployments
- Example: `EMAIL_PROVIDER=sendmail`

**Local Testing with MailHog/Mailpit**:
```bash
# Run MailHog (captures emails for testing)
docker run -d -p 5004:1025 -p 5005:8025 mailhog/mailhog

# Set in .env
EMAIL_PROVIDER=sendmail
SENDMAIL_DEV_PORT=5004
MAILHOG_WEB_PORT=5005
NODE_ENV=development

# View emails at http://localhost:5005
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

**Local Development**: When using sendmail in development mode, emails are sent to MailHog (port 5004) for testing without requiring SMTP credentials.

**Email Types**:
- `vendor_attached` - Sent when a vendor is first attached to a requisition
- `status_change` - Sent when contract status changes (e.g., Opened, Accepted, Rejected)
- `deal_notification` - Sent when a deal is created for vendor negotiation

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
# Run MailHog via Docker (maps container ports to host ports 5004/5005)
docker run -d --name mailhog -p 5004:1025 -p 5005:8025 mailhog/mailhog

# Configure .env (defaults work out of the box)
EMAIL_PROVIDER=sendmail
SENDMAIL_DEV_PORT=5004
MAILHOG_WEB_PORT=5005
NODE_ENV=development

# Start backend
npm run dev
```

**Verify**:
- Server logs show: `Email service initialized with provider: sendmail`
- Create contract or update status to trigger emails
- View captured emails at http://localhost:5005
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
- Production requires compilation: `npm run build` -> `dist/` folder
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

## Negotiation Chatbot System (January 2026 Refactor)

### Overview

The Negotiation Chatbot is a utility-based AI decision engine for procurement negotiations. It now operates with a **requisition-centric architecture**:

**Key Changes (January 2026)**:
- Requisition-based navigation: Requisitions -> Vendors -> Deals
- Nested URL structure: `/api/chatbot/requisitions/:rfqId/vendors/:vendorId/deals/:dealId`
- 4-step deal creation wizard with comprehensive negotiation parameters
- Weighted utility scoring with parameter-level breakdown
- Archive/unarchive functionality at both requisition and deal levels
- Vendor access tokens for direct deal access

### Two Negotiation Modes

- **INSIGHTS Mode**: Deterministic decision engine with utility scoring (default)
- **CONVERSATION Mode**: LLM-driven conversational negotiation

### Architecture (`src/modules/chatbot/`)

**Key Files**:
- `chatbot.service.ts` - Core business logic (3000+ lines)
  - Deal CRUD operations
  - Message processing for both modes
  - Weighted utility calculations
  - Smart defaults generation
  - Draft management
- `chatbot.controller.ts` - Express route handlers (1700+ lines)
- `chatbot.routes.ts` - API route definitions with nested URL structure
- `chatbot.validator.ts` - Joi/Zod validation schemas for all endpoints
- `engine/` - Decision engine components:
  - `types.ts` - TypeScript interfaces for weighted utility system
  - `decide.ts` - Decision logic (ACCEPT, COUNTER, WALK_AWAY, ESCALATE)
  - `utility.ts` - Legacy utility calculations
  - `parameterUtility.ts` - Per-parameter utility calculations
  - `weightedUtility.ts` - Weighted utility aggregation
  - `parseOffer.ts` - Vendor offer parsing
  - `processVendorTurn.ts` - Turn processing logic
- `vendor/` - Vendor-side components:
  - `vendorAgent.ts` - Vendor negotiation agent
  - `vendorPolicy.ts` - Vendor utility calculation and policies
  - `vendorSimulator.service.ts` - Simulated vendor responses

### API Routes (`/api/chatbot`)

**Requisition Views**:
```
GET    /requisitions                                    # List requisitions with deal stats
GET    /requisitions/for-negotiation                    # Available requisitions for negotiation
GET    /requisitions/:rfqId/deals                       # All deals for a requisition
GET    /requisitions/:rfqId/vendors                     # Vendors attached to requisition
POST   /requisitions/:rfqId/archive                     # Archive requisition (cascades to deals)
POST   /requisitions/:rfqId/unarchive                   # Unarchive requisition
```

**Smart Defaults & Drafts**:
```
GET    /requisitions/:rfqId/vendors/:vendorId/smart-defaults   # AI-suggested defaults
POST   /requisitions/:rfqId/vendors/:vendorId/drafts           # Save draft
GET    /requisitions/:rfqId/vendors/:vendorId/drafts           # List drafts
GET    /requisitions/:rfqId/vendors/:vendorId/drafts/:draftId  # Get draft
DELETE /requisitions/:rfqId/vendors/:vendorId/drafts/:draftId  # Delete draft
```

**Deal Management (Nested)**:
```
GET    /requisitions/:rfqId/vendors/:vendorId/deals                    # List deals
POST   /requisitions/:rfqId/vendors/:vendorId/deals                    # Create deal with config
GET    /requisitions/:rfqId/vendors/:vendorId/deals/:dealId            # Get deal + messages
GET    /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/config     # Get negotiation config
GET    /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/utility    # Get weighted utility
GET    /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/summary    # Get deal summary
GET    /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/explainability # Get audit trail
```

**Messaging (Unified for both modes)**:
```
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/messages     # Send message (?mode=INSIGHTS|CONVERSATION)
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/start        # Start conversation
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/suggestions  # Get AI suggestions
```

**Deal Lifecycle**:
```
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/reset        # Reset deal
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/archive      # Archive deal
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/unarchive    # Unarchive deal
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/retry-email  # Retry notification
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/resume       # Resume escalated deal
```

**Vendor Simulation & Demo**:
```
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/simulate     # Generate vendor message
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/demo         # Run full demo
```

**Vendor Negotiation (AI-PM Mode)**:
```
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/start-negotiation  # Start with AI opening
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/vendor-offer       # Submit vendor offer
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/vendor-accept      # Accept current terms
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/vendor-walk-away   # Walk away
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/vendor-suggestions # Get vendor suggestions
```

**Deal Lookup (Flat Access)**:
```
GET    /deals/:dealId/lookup   # Look up deal by ID only (returns context)
```

### Weighted Utility System

**Parameter Types** (`engine/types.ts`):
```typescript
type ParameterUtilityType = 'linear' | 'binary' | 'stepped' | 'date' | 'percentage' | 'boolean';
type ParameterDirection = 'lower_better' | 'higher_better' | 'match_target' | 'closer_better';
type ParameterStatus = 'excellent' | 'good' | 'warning' | 'critical';
```

**Weighted Parameter Config**:
```typescript
interface WeightedParameterConfig {
  id: string;
  name: string;
  weight: number;                    // 0-100, from Step 4 wizard
  source: 'step2' | 'step3' | 'custom';
  utilityType: ParameterUtilityType;
  direction: ParameterDirection;
  target: number | string | boolean | null;
  min?: number | string | null;
  max?: number | string | null;
  options?: string[];                // For stepped utility
  optionUtilities?: Record<string, number>;
}
```

**Utility Calculation** (`engine/weightedUtility.ts`):
- Formula: `Total Utility = SUM(Parameter_Utility x Parameter_Weight / 100)`
- Thresholds (configurable):
  - Accept: >= 70% (default)
  - Counter: 50-70%
  - Escalate: 30-50%
  - Walk Away: < 30%

**Utility Result**:
```typescript
interface WeightedUtilityResult {
  totalUtility: number;              // 0-1
  totalUtilityPercent: number;       // 0-100
  parameterUtilities: Record<string, ParameterUtilityResult>;
  thresholds: ThresholdConfig;
  recommendation: 'ACCEPT' | 'COUNTER' | 'ESCALATE' | 'WALK_AWAY';
  recommendationReason: string;
}
```

### Message Processing Flow (INSIGHTS Mode)

When a vendor message is received:

1. **Extract Offer** - Parse vendor message to extract structured offer (price, terms, etc.)
2. **Calculate Utilities** - Compute utility scores for each weighted parameter
3. **Make Decision** - Determine action (ACCEPT, COUNTER, WALK_AWAY, ESCALATE, ASK_CLARIFY)
4. **Generate Counter-Offer** - Create Accordo's counter-proposal using concession strategy
5. **Save Messages** - Store VENDOR message and auto-generated ACCORDO response
6. **Return Full Context** - Send updated deal, all messages, and utility breakdown

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

### API Response Format

**POST `/api/chatbot/requisitions/:rfqId/vendors/:vendorId/deals/:dealId/messages`**:
```typescript
{
  message: "Message processed successfully",
  data: {
    deal: Deal,              // Updated deal with new status/round
    messages: Message[],     // ALL messages for this deal
    latestMessage: Message,  // The vendor message just created
    decision: Decision,      // Engine decision (action, utilityScore, counterOffer)
    utility: WeightedUtilityResult,  // Full utility breakdown
    explainability: Explainability   // Detailed reasoning
  }
}
```

**POST `/api/chatbot/requisitions/:rfqId/vendors/:vendorId/deals/:dealId/reset`**:
```typescript
{
  message: "Deal reset successfully",
  data: {
    deal: Deal,       // Reset deal (round 0, status NEGOTIATING)
    messages: []      // Empty array (all messages deleted)
  }
}
```

**GET `/api/chatbot/requisitions/:rfqId/vendors/:vendorId/deals/:dealId/utility`**:
```typescript
{
  message: "Utility retrieved successfully",
  data: {
    utility: WeightedUtilityResult  // Full parameter breakdown
  }
}
```

### Database Schema

**ChatbotDeal Model** (`src/models/chatbotDeal.ts`):
- `id` (UUID) - Primary key
- `requisitionId`, `vendorId` - Foreign keys for nested structure
- `title`, `mode`, `status`, `round`
- `vendorAccessToken` - Unique token for vendor direct access
- `configJson` - Full wizard configuration (JSONB)
- `weightsJson` - Parameter weights from Step 4 (JSONB)
- `archived`, `archivedAt` - Soft delete support
- `createdBy` - User who created the deal

**ChatbotMessage Model** (`src/models/chatbotMessage.ts`):
- `role`: VENDOR | ACCORDO | SYSTEM
- `content`: Message text (vendor input or auto-generated Accordo response)
- `extractedOffer`: Parsed offer from vendor message (price, terms)
- `engineDecision`: Full Decision object (only for ACCORDO messages)
- `decisionAction`: Quick access to action (ACCEPT, COUNTER, etc.)
- `utilityScore`: Overall utility score (0-1)
- `counterOffer`: Accordo's counter-proposal (only for ACCORDO messages)
- `explainabilityJson`: Detailed utility breakdown and reasoning

### Training Data Logging System

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

**API Endpoint**:
- `POST /api/chatbot/requisitions/:rfqId/vendors/:vendorId/deals/:dealId/suggestions`
- Generates 4 suggestions per scenario (HARD, MEDIUM, SOFT, WALK_AWAY)
- Automatically logs training data after generating suggestions

## Vector & RAG System

### Overview

The Vector module provides semantic search, RAG (Retrieval-Augmented Generation), and vectorization capabilities for the negotiation system. It uses HuggingFace's `BAAI/bge-large-en-v1.5` model (1024 dimensions) for embeddings and PostgreSQL with in-memory vector storage.

### Architecture

```
                    Accordo Backend (Node.js)
                              |
         +--------------------+--------------------+
         |                    |                    |
         v                    v                    v
   Real-time              Batch Job           Query Service
   Queue                  (Migration)         (RAG/Search)
         |                    |                    |
         +--------------------+--------------------+
                              |
                              v
              Python Embedding Microservice (5003)
              (bge-large-en-v1.5)
                              |
                              v
              PostgreSQL + Arrays (Vector Storage)
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
python main.py  # Runs on port 5003
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
EMBEDDING_SERVICE_URL=http://localhost:5003
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

## Vendor Bid Comparison System

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
- `id` (UUID) - Primary key
- `requisitionId`, `contractId`, `dealId`, `vendorId` - Foreign keys
- `finalPrice`, `unitPrice`, `paymentTerms`, `deliveryDate`, `utilityScore`
- `bidStatus` (ENUM) - PENDING | COMPLETED | EXCLUDED | SELECTED | REJECTED
- `dealStatus` (ENUM) - NEGOTIATING | ACCEPTED | WALKED_AWAY | ESCALATED
- `chatSummaryMetrics` (JSONB), `chatSummaryNarrative` (TEXT), `chatLink`

**BidComparison** (`bid_comparisons` table):
- `requisitionId`, `triggeredBy`, `totalVendors`, `completedVendors`, `excludedVendors`
- `topBidsJson` (JSONB), `pdfUrl`, `sentToUserId`, `sentToEmail`, `emailStatus`

**VendorSelection** (`vendor_selections` table):
- Full audit trail for vendor selection decisions
- `selectedVendorId`, `selectedBidId`, `selectedPrice`, `selectionReason`, `selectionMethod`
- Auto-generated `poId`

**VendorNotification** (`vendor_notifications` table):
- Track post-selection notifications (SELECTION_WON | SELECTION_LOST)

### API Endpoints (`/api/bid-comparison`)

**Comparison Operations**:
- `GET /:requisitionId` - Get comparison status
- `GET /:requisitionId/bids` - List all bids
- `GET /:requisitionId/pdf` - Download PDF report
- `POST /:requisitionId/generate` - Manual trigger

**Selection Operations**:
- `POST /:requisitionId/select/:bidId` - Select winning vendor
- `GET /:requisitionId/selection` - Get selection details

### Trigger Mechanisms

**Automatic Triggers**:
1. **All Vendors Complete**: When all attached vendors complete negotiations
2. **Deadline Reached**: Hourly cron job checks `negotiationClosureDate`

**Manual Trigger**: Via `POST /api/bid-comparison/:requisitionId/generate`

## Swagger API Documentation

### Overview

The API documentation is powered by Swagger/OpenAPI 3.0, providing interactive documentation for all backend endpoints with health monitoring for all services.

### Access Points

| Endpoint | Description |
|----------|-------------|
| `http://localhost:5002/api-docs` | Swagger UI - Interactive API explorer |
| `http://localhost:5002/api-docs.json` | OpenAPI 3.0 JSON specification |

### Health Monitoring Endpoints (`/api/health`)

**Endpoints**:
- `GET /api/health` - Simple health check (for load balancers)
- `GET /api/health/services` - Comprehensive service health with latency metrics
- `GET /api/health/ready` - Kubernetes readiness probe
- `GET /api/health/live` - Kubernetes liveness probe

**Services Monitored**:
| Service | Check Method | Details |
|---------|--------------|---------|
| Database (PostgreSQL) | `sequelize.authenticate()` | Host, database name, dialect |
| LLM (Ollama) | `GET /api/tags` | Model availability, available models list |
| Embedding Service | `GET /health` | Device (GPU/CPU), model, dimension |
| Redis | `redis.ping()` | Host, port, connection status |
| Email (MailHog/SMTP) | TCP connection test | Provider, dev port, web UI URL |

**Response Format**:
```typescript
{
  status: 'healthy' | 'unhealthy' | 'degraded',
  timestamp: string,
  version: string,
  uptime: number,
  environment: string,
  services: [
    {
      name: string,
      status: 'healthy' | 'unhealthy' | 'degraded',
      latency: number,  // milliseconds
      message: string,
      details: object
    }
  ]
}
```

### Swagger Documentation Features

**Security**:
- JWT Bearer authentication configured
- Token persistence across requests (via `persistAuthorization: true`)

**API Tags** (categorization):
- Health - Service health monitoring
- Auth - Authentication and authorization
- Chatbot - Negotiation chatbot and deal management
- Bid Comparison - Vendor bid comparison and selection
- Vector - Vector search and RAG operations
- Requisition - Purchase requisition management
- Contract - Contract management
- Vendor - Vendor operations
- Company - Company management
- User - User management
- Product - Product catalog
- Dashboard - Dashboard analytics

### Configuration

**Dependencies**:
- `swagger-jsdoc` (^6.2.8) - JSDoc to OpenAPI conversion
- `swagger-ui-express` (^5.0.1) - Swagger UI middleware

## Requisition Module Enhancements (January 2026)

### New Endpoints

**For Chatbot Integration**:
- `GET /api/requisition/for-negotiation` - Get requisitions available for negotiation (status: Opened, In Progress)
- `GET /api/requisition/:id/vendors` - Get vendors attached to a requisition with contract details

### Enhanced Queries

**Repository Functions** (`requisition.repo.ts`):
- `getRequisitionsForNegotiation(companyId)` - Filters by status and includes project/product details
- `getRequisitionVendors(rfqId)` - Returns vendors with contract status and chatbot deal info

### Company Module Enhancements

**New Endpoints**:
- `GET /api/company/addresses` - Get company addresses for delivery location selection
- `GET /api/company/:id/addresses` - Get addresses for specific company

**New Model** (`src/models/address.ts`):
- Company address management for delivery locations
- Used in Step 2 of deal wizard for delivery location selection

## Comprehensive Seeding (`src/seeders/`)

### Seeder Structure

**Main Seeder** (`index.ts`):
- Development data with test users, companies, requisitions
- Configurable via `SEED_*` environment variables

**Comprehensive Seeder** (`comprehensiveSeed.ts`):
- Full test scenarios with multiple requisitions, vendors, and deals
- Creates realistic negotiation data for testing
- Run with: `npm run seed:comprehensive`

**Data Files** (`data/`):
- Static data for products, categories, etc.

**Helper Functions** (`helpers/`):
- Utility functions for creating test data
- Random data generators
