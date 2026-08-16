import type { Knex } from 'knex';
import * as dotenv from 'dotenv';

dotenv.config();

const config: Record<string, Knex.Config> = {
  development: {
    client: 'pg',

    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    },

    migrations: {
      directory: './src/database/knex/migrations',
    },

    seeds: {
      directory: './src/database/knex/seeds',
    },
  },
};

export default config;
