import { Sequelize } from "sequelize";
import pg from "pg";
import env from "./env.js";

const sslConfig = env.database.ssl
  ? {
      ssl: {
        require: true,
        rejectUnauthorized: env.database.sslRejectUnauthorized,
      },
    }
  : {};

const buildClientConfig = (database) => ({
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

export const ensureDatabaseExists = async () => {
  const adminDatabase = env.database.adminDatabase || "postgres";
  const client = new pg.Client(buildClientConfig(adminDatabase));

  try {
    await client.connect();
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [env.database.name]
    );

    if (result.rowCount === 0) {
      const dbName = env.database.name.replace(/"/g, '""');
      await client.query(`CREATE DATABASE "${dbName}"`);
      if (env.database.logging) {
        console.log(`Database ${env.database.name} created successfully.`);
      }
    }
  } catch (error) {
    console.error("Failed to ensure database exists:", error);
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
};

await ensureDatabaseExists();

export const sequelize = new Sequelize(
  env.database.name,
  env.database.username,
  env.database.password,
  {
    host: env.database.host,
    port: env.database.port,
    dialect: "postgres",
    dialectModule: pg,
    logging: env.database.logging ? console.log : false,
    ...sslConfig,
  }
);

export const connectDatabase = async () => {
  await sequelize.authenticate();
};

export default sequelize;
