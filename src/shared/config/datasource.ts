import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

config();

const nodeEnv = process.env.NODE_ENV || 'development';

// SSL configuration: enabled in staging/production (Railway), disabled in development (local)
const sslConfig =
  nodeEnv === 'staging' || nodeEnv === 'production'
    ? { rejectUnauthorized: false }
    : false;

export const AppDataSource = new DataSource({
  type: 'postgres',
  url:
    process.env.DATABASE_URL ||
    'postgresql://user:password@localhost:5432/agave_db',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'user',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'agave_db',
  ssl: sslConfig,
  synchronize: false,
  // Query logging solo en desarrollo para no afectar performance
  logging: nodeEnv === 'development',
  entities: [path.join(__dirname, '../database/entities/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, '../database/migrations/*{.ts,.js}')],
  migrationsTableName: 'migrations',
});
