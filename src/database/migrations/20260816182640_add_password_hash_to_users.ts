import { Knex } from 'knex';

export async function up(_knex: Knex): Promise<void> {
  // Password authentication is not used.
}

export async function down(_knex: Knex): Promise<void> {
  // Nothing to rollback.
}