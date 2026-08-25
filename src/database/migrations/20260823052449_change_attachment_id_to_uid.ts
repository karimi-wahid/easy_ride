import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.alterTable('attachments', (table) => {
    table
      .uuid('uid')
      .notNullable()
      .defaultTo(knex.raw('gen_random_uuid()'));
  });

  await knex.schema.alterTable('attachments', (table) => {
    table.unique(['uid']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachments', (table) => {
    table.dropUnique(['uid']);
    table.dropColumn('uid');
  });
}