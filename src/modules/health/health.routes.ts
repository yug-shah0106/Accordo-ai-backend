import { Router, Request, Response } from 'express';
import { getHealthReport, getSimpleHealth } from './health.service.js';

const healthRouter = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Simple health check
 *     description: Returns basic health status for load balancers and monitoring
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Accordo API is running
 */
healthRouter.get('/', async (_req: Request, res: Response) => {
  const health = await getSimpleHealth();
  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * @swagger
 * /api/health/services:
 *   get:
 *     summary: Comprehensive service health check
 *     description: |
 *       Returns detailed health information for all backend services:
 *       - **Database (PostgreSQL)**: Connection status
 *       - **LLM (Ollama)**: Model availability
 *       - **Embedding Service (Python)**: Vector embedding status
 *       - **Redis**: Cache connection (if configured)
 *       - **Email (MailHog/SMTP)**: Email service status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: All services healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             example:
 *               status: healthy
 *               timestamp: "2026-01-12T22:30:00.000Z"
 *               version: "1.0.0"
 *               uptime: 3600
 *               environment: development
 *               services:
 *                 - name: database
 *                   status: healthy
 *                   latency: 5
 *                   message: Connected to PostgreSQL
 *                 - name: llm
 *                   status: healthy
 *                   latency: 120
 *                   message: Ollama running with llama3.1
 *                 - name: embedding
 *                   status: healthy
 *                   latency: 45
 *                   message: Embedding service running on mps
 *                 - name: email
 *                   status: healthy
 *                   latency: 3
 *                   message: MailHog running on port 1025
 *       503:
 *         description: One or more services unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
healthRouter.get('/services', async (_req: Request, res: Response) => {
  const report = await getHealthReport();
  const statusCode = report.status === 'unhealthy' ? 503 : 200;
  res.status(statusCode).json(report);
});

/**
 * @swagger
 * /api/health/ready:
 *   get:
 *     summary: Readiness check
 *     description: Check if the service is ready to accept traffic (database connected)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ready:
 *                   type: boolean
 *                   example: true
 *       503:
 *         description: Service not ready
 */
healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const health = await getSimpleHealth();
  if (health.status === 'ok') {
    res.json({ ready: true });
  } else {
    res.status(503).json({ ready: false, reason: health.message });
  }
});

/**
 * @swagger
 * /api/health/live:
 *   get:
 *     summary: Liveness check
 *     description: Check if the service process is alive (always returns 200 if process is running)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 alive:
 *                   type: boolean
 *                   example: true
 *                 uptime:
 *                   type: number
 *                   example: 3600
 */
healthRouter.get('/live', (_req: Request, res: Response) => {
  res.json({
    alive: true,
    uptime: process.uptime(),
  });
});

export default healthRouter;
