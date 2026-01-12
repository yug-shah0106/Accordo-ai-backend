import swaggerJsdoc from 'swagger-jsdoc';
import env from './env.js';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Accordo AI Backend API',
      version: '1.0.0',
      description: `
## Accordo AI - B2B Procurement Negotiation Platform

This API provides endpoints for:
- **Authentication** - User registration, login, and JWT token management
- **Negotiation Chatbot** - AI-powered utility-based negotiation engine
- **Bid Comparison** - Multi-vendor bid tracking, PDF reports, and vendor selection
- **Vector Search** - RAG-enhanced semantic search for negotiations
- **Requisitions & Contracts** - Purchase requisition and contract management
- **Company & Vendor Management** - Company and vendor entity operations

### Service Health Monitoring
Use the \`/api/health/services\` endpoint to check the status of all backend services including:
- Database (PostgreSQL)
- LLM Service (Ollama)
- Embedding Service (Python FastAPI)
- Redis (if configured)
      `,
      contact: {
        name: 'Accordo AI Support',
        email: 'support@accordo.ai',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.port}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from /api/auth/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message' },
            error: { type: 'string', example: 'Detailed error' },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
            data: { type: 'object' },
          },
        },
        ServiceHealth: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'database' },
            status: { type: 'string', enum: ['healthy', 'unhealthy', 'degraded'], example: 'healthy' },
            latency: { type: 'number', example: 5.2 },
            message: { type: 'string', example: 'Connected to PostgreSQL' },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'unhealthy', 'degraded'] },
            timestamp: { type: 'string', format: 'date-time' },
            version: { type: 'string', example: '1.0.0' },
            uptime: { type: 'number', example: 3600 },
            services: {
              type: 'array',
              items: { $ref: '#/components/schemas/ServiceHealth' },
            },
          },
        },
        Deal: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string', example: 'Office Supplies Negotiation' },
            status: { type: 'string', enum: ['NEGOTIATING', 'ACCEPTED', 'WALKED_AWAY', 'ESCALATED'] },
            mode: { type: 'string', enum: ['INSIGHTS', 'CONVERSATION'] },
            currentRound: { type: 'integer', example: 3 },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            dealId: { type: 'string', format: 'uuid' },
            role: { type: 'string', enum: ['VENDOR', 'ACCORDO', 'SYSTEM'] },
            content: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        VendorBid: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            requisitionId: { type: 'integer' },
            vendorId: { type: 'integer' },
            finalPrice: { type: 'number', example: 95000 },
            unitPrice: { type: 'number', example: 95 },
            paymentTerms: { type: 'string', example: 'Net 30' },
            bidStatus: { type: 'string', enum: ['PENDING', 'COMPLETED', 'EXCLUDED', 'SELECTED', 'REJECTED'] },
            utilityScore: { type: 'number', example: 0.85 },
          },
        },
        BidComparison: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            requisitionId: { type: 'integer' },
            triggeredBy: { type: 'string', enum: ['ALL_COMPLETED', 'DEADLINE_REACHED', 'MANUAL'] },
            totalVendors: { type: 'integer', example: 5 },
            completedVendors: { type: 'integer', example: 4 },
            pdfUrl: { type: 'string' },
            emailStatus: { type: 'string', enum: ['PENDING', 'SENT', 'FAILED'] },
          },
        },
      },
    },
    tags: [
      { name: 'Health', description: 'Service health monitoring endpoints' },
      { name: 'Auth', description: 'Authentication and authorization' },
      { name: 'Chatbot', description: 'Negotiation chatbot and deal management' },
      { name: 'Bid Comparison', description: 'Vendor bid comparison and selection' },
      { name: 'Vector', description: 'Vector search and RAG operations' },
      { name: 'Requisition', description: 'Purchase requisition management' },
      { name: 'Contract', description: 'Contract management' },
      { name: 'Vendor', description: 'Vendor operations' },
      { name: 'Company', description: 'Company management' },
      { name: 'User', description: 'User management' },
      { name: 'Product', description: 'Product catalog' },
      { name: 'Dashboard', description: 'Dashboard analytics' },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/modules/health/*.ts',
    './src/modules/swagger.docs.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
