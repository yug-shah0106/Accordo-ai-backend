import { Sequelize, Options } from 'sequelize';
import pg from 'pg';
import env from './env.js';

interface SSLConfig {
  ssl?: {
    require: boolean;
    rejectUnauthorized: boolean;
  };
}

interface ClientConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: {
    require: boolean;
    rejectUnauthorized: boolean;
  };
}

const sslConfig: SSLConfig = env.database.ssl
  ? {
      ssl: {
        require: true,
        rejectUnauthorized: env.database.sslRejectUnauthorized,
      },
    }
  : {};

const buildClientConfig = (database: string): ClientConfig => ({
  host: env.database.host,
  port: env.database.port,
  user: env.database.username,
  password: env.database.password,
  database,
  ...(env.database.ssl
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: env.database.sslRejectUnauthorized,
        },
      }
    : {}),
});

export const ensureDatabaseExists = async (): Promise<void> => {
  const adminDatabase = env.database.adminDatabase || 'postgres';
  const client = new pg.Client(buildClientConfig(adminDatabase));

  try {
    await client.connect();
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [env.database.name]
    );

    if (result.rowCount === 0) {
      const dbName = env.database.name;
      if (!/^[a-zA-Z0-9_-]+$/.test(dbName)) {
        throw new Error('Invalid database name');
      }
      await client.query(`CREATE DATABASE "${dbName}"`);
      if (env.database.logging) {
        console.log(`Database ${env.database.name} created successfully.`);
      }
    }
  } catch (error) {
    console.error('Failed to ensure database exists:', error);
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
};

// Ensure database exists before creating Sequelize instance
await ensureDatabaseExists();

const sequelizeOptions: Options = {
  host: env.database.host,
  port: env.database.port,
  dialect: 'postgres',
  dialectModule: pg,
  logging: env.database.logging ? console.log : false,
  dialectOptions: env.database.ssl
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: env.database.sslRejectUnauthorized,
        },
      }
    : undefined,
};

export const sequelize = new Sequelize(
  env.database.name,
  env.database.username,
  env.database.password,
  sequelizeOptions
);

export const connectDatabase = async (): Promise<void> => {
  await sequelize.authenticate();
  // Auto-sync models to database (creates tables if they don't exist)
  await sequelize.sync();
  // Auto-seed essential data (uses findOrCreate, safe to run multiple times)
  const { seedAll } = await import('../seeders/index.js');
  await seedAll();
};

export default sequelize;
