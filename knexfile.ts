import type { Knex } from 'knex';
import 'dotenv/config';

const config: Knex.Config = {
  client: 'pg',

  connection: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },

  migrations: {
    directory: './src/database/migrations',
    extension: 'ts',
  },
};

export default config;
