import { sequelize } from '../../config/database.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface HealthReport {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  environment: string;
  services: ServiceStatus[];
}

const startTime = Date.now();

/**
 * Check PostgreSQL database connection
 */
async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await sequelize.authenticate();
    const latency = Date.now() - start;
    return {
      name: 'database',
      status: 'healthy',
      latency,
      message: 'Connected to PostgreSQL',
      details: {
        host: env.database.host,
        database: env.database.name,
        dialect: 'postgres',
      },
    };
  } catch (error) {
    const latency = Date.now() - start;
    logger.error('Database health check failed', { error });
    return {
      name: 'database',
      status: 'unhealthy',
      latency,
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

/**
 * Check Ollama LLM service
 */
async function checkLLM(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${env.llm.baseURL}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latency = Date.now() - start;

    if (response.ok) {
      const data = await response.json() as { models?: Array<{ name: string }> };
      const modelAvailable = data.models?.some((m) => m.name.includes(env.llm.model));

      return {
        name: 'llm',
        status: modelAvailable ? 'healthy' : 'degraded',
        latency,
        message: modelAvailable
          ? `Ollama running with ${env.llm.model}`
          : `Ollama running but ${env.llm.model} not found`,
        details: {
          baseUrl: env.llm.baseURL,
          model: env.llm.model,
          availableModels: data.models?.map((m) => m.name).slice(0, 5),
        },
      };
    } else {
      return {
        name: 'llm',
        status: 'unhealthy',
        latency,
        message: `Ollama responded with status ${response.status}`,
      };
    }
  } catch (error) {
    const latency = Date.now() - start;
    return {
      name: 'llm',
      status: 'unhealthy',
      latency,
      message: error instanceof Error ? error.message : 'LLM service unavailable',
      details: {
        baseUrl: env.llm.baseURL,
        model: env.llm.model,
      },
    };
  }
}

/**
 * Check Python embedding service
 */
async function checkEmbeddingService(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${env.vector.embeddingServiceUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latency = Date.now() - start;

    if (response.ok) {
      const data = await response.json() as {
        status: string;
        device?: string;
        model?: string;
        embedding_dim?: number;
      };

      return {
        name: 'embedding',
        status: 'healthy',
        latency,
        message: `Embedding service running on ${data.device || 'unknown device'}`,
        details: {
          url: env.vector.embeddingServiceUrl,
          model: data.model || env.vector.embeddingModel,
          dimension: data.embedding_dim || env.vector.embeddingDimension,
          device: data.device,
        },
      };
    } else {
      return {
        name: 'embedding',
        status: 'unhealthy',
        latency,
        message: `Embedding service responded with status ${response.status}`,
      };
    }
  } catch (error) {
    const latency = Date.now() - start;
    return {
      name: 'embedding',
      status: 'unhealthy',
      latency,
      message: error instanceof Error ? error.message : 'Embedding service unavailable',
      details: {
        url: env.vector.embeddingServiceUrl,
      },
    };
  }
}

/**
 * Check Redis connection (if configured)
 */
async function checkRedis(): Promise<ServiceStatus | null> {
  if (!env.redisUrl) {
    return null;
  }

  const start = Date.now();
  try {
    // Simple TCP check for Redis
    const url = new URL(env.redisUrl);
    const { default: net } = await import('net');

    return new Promise((resolve) => {
      const socket = net.createConnection({
        host: url.hostname,
        port: Number(url.port) || 6379,
        timeout: 5000,
      });

      socket.on('connect', () => {
        const latency = Date.now() - start;
        socket.destroy();
        resolve({
          name: 'redis',
          status: 'healthy',
          latency,
          message: 'Redis connection successful',
          details: {
            host: url.hostname,
            port: url.port || 6379,
          },
        });
      });

      socket.on('error', (error) => {
        const latency = Date.now() - start;
        socket.destroy();
        resolve({
          name: 'redis',
          status: 'unhealthy',
          latency,
          message: error.message,
        });
      });

      socket.on('timeout', () => {
        const latency = Date.now() - start;
        socket.destroy();
        resolve({
          name: 'redis',
          status: 'unhealthy',
          latency,
          message: 'Redis connection timeout',
        });
      });
    });
  } catch (error) {
    const latency = Date.now() - start;
    return {
      name: 'redis',
      status: 'unhealthy',
      latency,
      message: error instanceof Error ? error.message : 'Redis check failed',
    };
  }
}

/**
 * Check MailHog/email service (in development)
 */
async function checkEmailService(): Promise<ServiceStatus> {
  const start = Date.now();

  if (env.emailProvider === 'sendmail' && env.nodeEnv === 'development') {
    try {
      const { default: net } = await import('net');
      const port = env.smtp.devPort || 1025;

      return new Promise((resolve) => {
        const socket = net.createConnection({
          host: '127.0.0.1',
          port,
          timeout: 5000,
        });

        socket.on('connect', () => {
          const latency = Date.now() - start;
          socket.destroy();
          resolve({
            name: 'email',
            status: 'healthy',
            latency,
            message: `MailHog/Mailpit running on port ${port}`,
            details: {
              provider: 'sendmail',
              devPort: port,
              webUI: `http://localhost:8025`,
            },
          });
        });

        socket.on('error', () => {
          const latency = Date.now() - start;
          socket.destroy();
          resolve({
            name: 'email',
            status: 'degraded',
            latency,
            message: `MailHog not running on port ${port} - emails will fail`,
            details: {
              provider: 'sendmail',
              devPort: port,
            },
          });
        });

        socket.on('timeout', () => {
          const latency = Date.now() - start;
          socket.destroy();
          resolve({
            name: 'email',
            status: 'degraded',
            latency,
            message: 'MailHog connection timeout',
          });
        });
      });
    } catch (error) {
      const latency = Date.now() - start;
      return {
        name: 'email',
        status: 'degraded',
        latency,
        message: error instanceof Error ? error.message : 'Email service check failed',
      };
    }
  } else if (env.emailProvider === 'nodemailer' && env.smtp.host) {
    // For nodemailer, just report configured status
    const latency = Date.now() - start;
    return {
      name: 'email',
      status: 'healthy',
      latency,
      message: `SMTP configured: ${env.smtp.host}:${env.smtp.port}`,
      details: {
        provider: 'nodemailer',
        host: env.smtp.host,
        port: env.smtp.port,
      },
    };
  }

  const latency = Date.now() - start;
  return {
    name: 'email',
    status: 'degraded',
    latency,
    message: 'Email service not configured',
  };
}

/**
 * Get comprehensive health report for all services
 */
export async function getHealthReport(): Promise<HealthReport> {
  const checks = await Promise.all([
    checkDatabase(),
    checkLLM(),
    checkEmbeddingService(),
    checkRedis(),
    checkEmailService(),
  ]);

  const services = checks.filter((s): s is ServiceStatus => s !== null);

  // Determine overall status
  const hasUnhealthy = services.some((s) => s.status === 'unhealthy');
  const hasDegraded = services.some((s) => s.status === 'degraded');

  // Database is critical - if it's down, whole system is unhealthy
  const dbStatus = services.find((s) => s.name === 'database');

  let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
  if (dbStatus?.status === 'unhealthy') {
    overallStatus = 'unhealthy';
  } else if (hasUnhealthy) {
    overallStatus = 'degraded';
  } else if (hasDegraded) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    environment: env.nodeEnv,
    services,
  };
}

/**
 * Get simple health status (for load balancers)
 */
export async function getSimpleHealth(): Promise<{ status: string; message: string }> {
  try {
    await sequelize.authenticate();
    return { status: 'ok', message: 'Accordo API is running' };
  } catch (error) {
    return { status: 'error', message: 'Database connection failed' };
  }
}
