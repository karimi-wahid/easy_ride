import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('rides', (table) => {
    table
      .timestamp('search_started_at', { useTz: true })
      .nullable()
      .comment('When the ride search started');

    table
      .timestamp('search_expires_at', { useTz: true })
      .nullable()
      .comment('When the ride search expires');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('rides', (table) => {
    table.dropColumn('search_started_at');
    table.dropColumn('search_expires_at');
  });
}