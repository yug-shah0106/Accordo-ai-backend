# Accordo AI — Backend

AI-powered B2B procurement negotiation engine built with TypeScript, Node.js, Express, and PostgreSQL. Features utility-based decision making, MESO negotiations, and behavioral analysis.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database credentials and config

# Run database migrations
npm run migrate

# Start development server (auto-reload)
npm run dev
```

The API runs on **http://localhost:5002** by default.

## Environment Setup

Create `.env` from `.env.example`. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5002` | API server port |
| `DB_HOST` | `127.0.0.1` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `accordo` | Database name |
| `DB_USERNAME` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `JWT_SECRET` | — | JWT signing secret |
| `LLM_BASE_URL` | `http://localhost:11434` | Ollama LLM endpoint |
| `LLM_MODEL` | `qwen3` | LLM model name |
| `VENDOR_PORTAL_URL` | `http://localhost:5001/vendor` | Frontend vendor portal URL |
| `CHATBOT_FRONTEND_URL` | `http://localhost:5001` | Frontend base URL |

See `.env.example` for the full list including email (SMTP/SES), OpenAI, and embedding service configuration.

## Commands

```bash
# Development
npm run dev              # Start with auto-reload (tsx watch)
npm run dev:clean        # Kill existing processes and restart
npm run dev:kill         # Kill dev processes

# Build & Production
npm run build            # Compile TypeScript to dist/
npm start                # Run compiled JavaScript
npm run type-check       # Type-check without emitting

# Database
npm run migrate          # Run Sequelize migrations
npm run migrate:undo     # Undo last migration
npm run seed             # Run seed data

# Testing (Vitest)
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report

# Code Quality
npm run lint             # ESLint
```

## Docker

```bash
# Build and start (backend + PostgreSQL)
docker compose up -d --build

# Production with custom environment
docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down

# Stop and remove data
docker compose down -v
```

### Docker Features

- Multi-stage build (deps → builder → production)
- Automatic database migrations on startup
- Health checks for both backend and PostgreSQL
- Alpine-based images for minimal footprint
- Native module support (cairo, pango) for PDF generation
- Resource limits and logging configuration

## Architecture

```
src/
├── config/              # Environment, database, logger
├── middlewares/         # Auth, error handling, file upload
├── models/              # Sequelize TypeScript models
├── modules/
│   ├── chatbot/         # Negotiation chatbot (main feature)
│   │   ├── engine/      # Decision engine, behavioral analysis, utility scoring
│   │   ├── pdf/         # Deal summary PDF generation
│   │   └── *.ts         # Controller, service, routes, validator
│   ├── vendor-chat/     # Vendor-facing MESO negotiation portal
│   ├── bidAnalysis/     # Vendor bid comparison and selection
│   ├── vector/          # RAG and semantic search
│   └── ...              # Auth, requisition, contract, PO, company, vendor
├── services/            # Shared services (LLM, email)
├── types/               # Shared TypeScript types
└── index.ts             # Express app entry point
```

### Module Pattern

Each module follows: `controller.ts` → `service.ts` → `routes.ts` → `validator.ts`

## Negotiation Engine

### Core Engine (`modules/chatbot/engine/`)

| File | Purpose |
|------|---------|
| `decide.ts` | Decision engine — utility thresholds, counter-offer generation, dynamic round limits |
| `utility.ts` | Core utility calculations (price, terms, weighted) |
| `weightedUtility.ts` | Multi-parameter weighted utility scoring |
| `meso.ts` | MESO option generation with phased flow control |
| `behavioralAnalyzer.ts` | Behavioral signal extraction — concession velocity, convergence, momentum |
| `historicalAnalyzer.ts` | Historical deal analysis for anchor adjustment |
| `preferenceDetector.ts` | Vendor emphasis detection (price vs terms focused) |
| `offerAccumulator.ts` | Multi-message partial offer merging |
| `parseOffer.ts` | Regex-based offer extraction from messages |
| `responseGenerator.ts` | LLM-powered human-like response generation |
| `toneDetector.ts` | Vendor emotional tone analysis |
| `types.ts` | Engine type definitions (NegotiationState, MesoCycleState, etc.) |

### Key Features

| Feature | Description |
|---------|-------------|
| Adaptive Strategy | Behavioral analysis adjusts strategy in real-time (Holding Firm, Accelerating, Matching Pace, Final Push) |
| Dynamic Round Limits | Soft max/hard max with auto-extension when converging, early escalation when stalling |
| Historical Anchoring | Adjusts opening anchor based on past deal outcomes with the same vendor |
| Weighted Utility | Multi-parameter utility (price, payment terms, delivery, custom) with configurable weights |
| Two Modes | INSIGHTS (deterministic engine) and CONVERSATION (LLM-driven) |
| Contract-Deal Sync | Automatic contract status updates based on deal lifecycle |
| PDF Reports | Deal summary PDF generation with charts |

## MESO + Others Flow

The backend implements a phased MESO (Multiple Equivalent Simultaneous Offers) negotiation approach:

### Flow Phases

| Phase | Rounds | Description |
|-------|--------|-------------|
| Normal Negotiation | 1-5 | Standard text-based negotiation |
| MESO Presentation | After 5 | Generate and present 3 MESO offers + "Others" option |
| Others Submission | On selection | Vendor submits custom price + payment terms |
| Post-Others | 4 rounds | Text negotiation before next MESO cycle |
| Stall Detection | After 3 identical | "Is this your final offer?" prompt |
| Final MESO | On confirmation | MESO without "Others" option |
| Escalation | After 5 cycles | Notify human PM |

### MESO State Tracking

```typescript
// Tracked in NegotiationState
interface MesoCycleState {
  mesoCycleNumber: number;        // Current cycle (1-5 max)
  lastMesoShownAtRound: number;   // When MESO was last shown
  roundsInCurrentCycle: number;   // Rounds since Others (0-4)
  othersSelectedCount: number;    // Times vendor selected Others
  inPostOthersPhase: boolean;     // Currently in post-Others phase
}

interface FinalOfferState {
  vendorConfirmedFinal: boolean;  // Vendor confirmed final offer
  stalledPrice?: number;          // The stalled price value
  finalMesoShown: boolean;        // Final MESO (no Others) shown
}
```

### Vendor-Chat Endpoints

New endpoints for vendor MESO flow (`/api/vendor-chat/`):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/meso/select` | POST | Select MESO option (auto-accepts deal) |
| `/meso/others` | POST | Submit custom price + payment terms |
| `/final-offer/confirm` | POST | Confirm/deny final offer |

All vendor-chat endpoints use `uniqueToken` authentication (no JWT required).

### Counter-Offer Logic

When the PM's calculated counter-price exceeds the vendor's offer, the system:
1. Caps the counter at the vendor's price (never overpay)
2. Pushes harder on payment terms to make progress
3. Strategy: "Price matched vendor's offer; pushing for shorter payment terms"

## API Endpoints

All routes under `/api`:

| Group | Base Path | Description |
|-------|-----------|-------------|
| Auth | `/api/auth` | JWT authentication |
| Chatbot | `/api/chatbot/requisitions/:rfqId/vendors/:vendorId/deals/:dealId` | Negotiation chatbot |
| Vendor Chat | `/api/vendor-chat` | Vendor-facing portal (token auth) |
| Bid Analysis | `/api/bid-analysis` | Vendor bid comparison |
| Requisitions | `/api/requisition` | Purchase requisitions |
| Contracts | `/api/contract` | Contract management |
| Vendors | `/api/vendor` | Vendor management |
| Health | `/api/health` | Service health check |

Swagger docs available at `http://localhost:5002/api-docs`.

### Chatbot Endpoints

```
# Deal Management
GET    /requisitions/:rfqId/vendors/:vendorId/deals              # List deals
POST   /requisitions/:rfqId/vendors/:vendorId/deals              # Create deal
GET    /requisitions/:rfqId/vendors/:vendorId/deals/:dealId      # Get deal
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/messages  # Send message

# MESO Flow (authenticated)
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/meso/select  # Select MESO
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/meso/others  # Submit Others
POST   /requisitions/:rfqId/vendors/:vendorId/deals/:dealId/final-offer/confirm
```

### Vendor-Chat Endpoints (Token Auth)

```
# Quote Management
POST   /quote              # Submit initial quote
GET    /can-edit-quote     # Check if quote editable
PUT    /quote              # Edit quote

# Chat
GET    /deal               # Get deal data
POST   /enter              # Enter chat
POST   /message            # Send vendor message
POST   /pm-response        # Get PM response

# MESO Flow
POST   /meso/select        # Select MESO option
POST   /meso/others        # Submit Others form
POST   /final-offer/confirm # Confirm final offer
```

## Port Configuration

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5001 | React/Vite application |
| **Backend API** | **5002** | **This Express.js server** |
| Embedding Service | 5003 | Python FastAPI (optional) |
| MailHog SMTP | 5004 | Email testing |
| MailHog Web UI | 5005 | Email testing UI |

> Port 5000 is reserved by macOS AirPlay Receiver.

## Tech Stack

- **Runtime**: Node.js 20 + TypeScript (ES Modules)
- **Framework**: Express.js
- **Database**: PostgreSQL 15 + Sequelize ORM
- **Testing**: Vitest
- **LLM**: Ollama (local) / OpenAI GPT-3.5
- **PDF**: PDFKit + Chart.js
- **Validation**: Joi + Zod
- **Logging**: Winston with daily rotation

## Database Models

Key models for negotiation:

| Model | Description |
|-------|-------------|
| `ChatbotDeal` | Negotiation deal with status, rounds, config |
| `ChatbotMessage` | Messages (VENDOR, ACCORDO, SYSTEM roles) |
| `ChatbotDraft` | Auto-saved deal drafts |
| `MesoRound` | MESO round data with options and selection |
| `Contract` | Contract linked to deal |
| `Requisition` | RFQ with products and vendors |

## Troubleshooting

### PostgreSQL Sequence Sync

If contract creation fails with `SequelizeUniqueConstraintError: id must be unique`:

```sql
SELECT setval('"Contracts_id_seq"', (SELECT MAX(id) FROM "Contracts"));
```

### Email Testing

Local email testing with MailHog:

```bash
docker run -d -p 5004:1025 -p 5005:8025 mailhog/mailhog
```

View emails at http://localhost:5005

## License

Proprietary — Accordo AI
