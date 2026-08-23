import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table
      .uuid('attachment_id')
      .nullable()
      .references('uid')
      .inTable('attachments')
      .onDelete('SET NULL')
      .onUpdate('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropForeign(['attachment_id']);
    table.dropColumn('attachment_id');
  });
}