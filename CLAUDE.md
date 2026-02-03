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
npm start                # Run compiled JavaScript
npm run type-check       # Type check without emitting files

# Database
npm run migrate          # Run Sequelize migrations
npm run migrate:undo     # Undo last migration
npm run seed             # Run seed data
npm run seed:comprehensive  # Full test scenarios

# Testing (Vitest)
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:ui          # Interactive UI
npm run test:coverage    # With coverage report

# Run a single test file
npx vitest tests/product.test.ts

# Code Quality
npm run lint             # ESLint on src/**/*.ts
```

## Architecture

### Module Pattern
Each feature module in `src/modules/` follows:
- `*.controller.ts` - Express request handlers
- `*.service.ts` - Business logic
- `*.repo.ts` - Database queries (when needed)
- `*.routes.ts` - Express router definitions
- `*.validator.ts` - Joi/Zod validation schemas

### Key Directories
- `src/models/` - Sequelize TypeScript models (associations in `index.ts`)
- `src/middlewares/` - Auth, error handling, file upload
- `src/services/` - Shared services (LLM, email, chatbot)
- `src/config/` - Environment, database, logger
- `src/types/` - Shared TypeScript types
- `migrations/` - Sequelize migrations (CommonJS `.cjs` format)
- `tests/` - Vitest test files

### Import Convention
**All imports use `.js` extensions** (TypeScript ES Modules convention):
```typescript
// Correct - refers to compiled output
import { User } from '../models/user.js';

// Incorrect
import { User } from '../models/user.ts';  // Don't use .ts
import { User } from '../models/user';     // Extension required
```

### Path Aliases
Available in tsconfig.json: `@/*`, `@config/*`, `@models/*`, `@modules/*`, `@middlewares/*`, `@services/*`, `@utils/*`, `@types/*`

### Request Context
The `Request` object is augmented by `authMiddleware`:
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

## API Routes

All routes prefixed with `/api`:
- `/api/auth` - Authentication (JWT)
- `/api/chatbot` - Negotiation chatbot (nested: `/requisitions/:rfqId/vendors/:vendorId/deals/:dealId`)
- `/api/bid-analysis` - Vendor bid comparison and selection
- `/api/bid-comparison` - Bid comparison and PDF generation
- `/api/requisition` - Purchase requisitions
- `/api/contract`, `/api/po` - Contracts and purchase orders
- `/api/vendor`, `/api/company` - Entity management
- `/api/health` - Service health monitoring
- `/api/vector` - RAG and semantic search

**Swagger docs**: `http://localhost:5002/api-docs`

## Port Configuration

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5001 | React/Vite (separate repo) |
| Backend API | 5002 | This Express.js server |
| Embedding Service | 5003 | Python FastAPI |
| MailHog SMTP | 5004 | Email testing |
| MailHog Web UI | 5005 | View test emails |

> Port 5000 is reserved by macOS AirPlay Receiver.

## Configuration

Copy `.env.example` to `.env`. Key settings:
- `PORT=5002` - Backend API port
- `DB_*` - PostgreSQL connection
- `JWT_*` - Authentication tokens
- `LLM_BASE_URL`, `LLM_MODEL` - Ollama config (default: llama3.2)
- `EMAIL_PROVIDER` - 'nodemailer' or 'sendmail'
- `EMBEDDING_SERVICE_URL` - Python embedding service

Database auto-creates if it doesn't exist. Models auto-sync on startup.

## Testing

Tests use **Vitest** with a separate test database (`DB_NAME_TEST` or `accordo_test`).

Test files live in `tests/` directory:
- `tests/setup.ts` - Database setup/teardown
- `tests/factories.ts` - Test data factories

The test setup syncs the database schema and cleans up after each test.

## Key Systems

### Negotiation Chatbot (`src/modules/chatbot/`)
- **INSIGHTS Mode**: Deterministic utility-based decision engine
- **CONVERSATION Mode**: LLM-driven negotiation
- Weighted utility scoring for multi-parameter negotiations
- Vendor perspective pricing (vendors want higher prices)

### Bid Analysis (`src/modules/bidAnalysis/`)
- Compare vendor bids across requisitions
- PDF report generation with charts
- Audit trail for selection decisions

### Vector/RAG (`src/modules/vector/`)
- Semantic search via Python embedding service (bge-large-en-v1.5)
- Context retrieval for AI negotiations

### Email Service (`src/services/email.service.ts`)
- Supports nodemailer (SMTP) and sendmail providers
- Auto-detection based on config
- Local testing with MailHog: `docker run -d -p 5004:1025 -p 5005:8025 mailhog/mailhog`

## Troubleshooting

### PostgreSQL Sequence Sync
If contract creation fails with `SequelizeUniqueConstraintError: id must be unique`:
```sql
SELECT setval('"Contracts_id_seq"', (SELECT MAX(id) FROM "Contracts"));
```
