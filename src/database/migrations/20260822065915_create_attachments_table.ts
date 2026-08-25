import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('attachments', (table) => {
    table.increments('id').primary();

    table.string('image_name').notNullable();
    table.string('image_type').notNullable();
    table.string('object_key').notNullable();

    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('claimed_at').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('attachments');
}