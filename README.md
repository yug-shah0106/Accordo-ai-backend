# Accordo AI — Backend

AI-powered B2B procurement negotiation engine built with TypeScript, Node.js, Express, and PostgreSQL.

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

# With custom environment
DB_PASSWORD=secret JWT_SECRET=myjwt docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down

# Stop and remove data
docker compose down -v
```

The Docker setup uses a multi-stage build (deps → builder → production) with:
- Automatic database migrations on startup
- Health checks for both backend and PostgreSQL
- Alpine-based images for minimal footprint
- Native module support (cairo, pango) for PDF generation

## Architecture

```
src/
├── config/          # Environment, database, logger
├── middlewares/      # Auth, error handling, file upload
├── models/          # Sequelize TypeScript models
├── modules/
│   ├── chatbot/     # Negotiation chatbot (main feature)
│   │   ├── engine/  # Decision engine, behavioral analysis, utility scoring
│   │   ├── pdf/     # Deal summary PDF generation
│   │   └── *.ts     # Controller, service, routes, validator
│   ├── bidAnalysis/ # Vendor bid comparison and selection
│   ├── vector/      # RAG and semantic search
│   ├── vendor-chat/ # Vendor-facing negotiation portal
│   └── ...          # Auth, requisition, contract, PO, company, vendor
├── services/        # Shared services (LLM, email)
├── types/           # Shared TypeScript types
└── index.ts         # Express app entry point
```

### Module Pattern

Each module follows: `controller.ts` → `service.ts` → `routes.ts` → `validator.ts`

### Negotiation Engine (`modules/chatbot/engine/`)

| File | Purpose |
|------|---------|
| `decide.ts` | Decision engine — utility thresholds, counter-offer generation, dynamic round limits |
| `utility.ts` | Core utility calculations (price, terms, weighted) |
| `weightedUtility.ts` | Multi-parameter weighted utility scoring |
| `behavioralAnalyzer.ts` | Behavioral signal extraction — concession velocity, convergence, momentum |
| `historicalAnalyzer.ts` | Historical deal analysis for anchor adjustment |
| `preferenceDetector.ts` | Vendor emphasis detection (price vs terms focused) |
| `offerAccumulator.ts` | Multi-message partial offer merging |
| `parseOffer.ts` | Regex-based offer extraction from messages |
| `responseGenerator.ts` | LLM-powered human-like response generation |
| `toneDetector.ts` | Vendor emotional tone analysis |
| `concernExtractor.ts` | Vendor concern identification |
| `processVendorTurn.ts` | Vendor turn orchestration (transaction-safe) |
| `types.ts` | Engine type definitions |

### Key Features

- **Adaptive Negotiation Engine**: Behavioral analysis adjusts strategy in real-time (Holding Firm, Accelerating, Matching Pace, Final Push)
- **Dynamic Round Limits**: Soft max/hard max with auto-extension when converging, early escalation when stalling
- **Historical Anchoring**: Adjusts opening anchor based on past deal outcomes with the same vendor
- **Weighted Utility Scoring**: Multi-parameter utility (price, payment terms, delivery, custom) with configurable weights
- **Two Negotiation Modes**: INSIGHTS (deterministic engine) and CONVERSATION (LLM-driven)
- **Contract-Deal Sync**: Automatic contract status updates based on deal lifecycle
- **PDF Reports**: Deal summary PDF generation with charts

## API Endpoints

All routes under `/api`:

| Group | Base Path | Description |
|-------|-----------|-------------|
| Auth | `/api/auth` | JWT authentication |
| Chatbot | `/api/chatbot/requisitions/:rfqId/vendors/:vendorId/deals/:dealId` | Negotiation chatbot |
| Bid Analysis | `/api/bid-analysis` | Vendor bid comparison |
| Requisitions | `/api/requisition` | Purchase requisitions |
| Contracts | `/api/contract` | Contract management |
| Vendors | `/api/vendor` | Vendor management |
| Health | `/api/health` | Service health check |

Swagger docs available at `http://localhost:5002/api-docs`.

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
- **PDF**: PDFKit
- **Validation**: Joi + Zod
- **Logging**: Winston with daily rotation
