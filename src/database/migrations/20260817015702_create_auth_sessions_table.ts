import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('auth_sessions', (table) => {
    table.increments('id').primary();

    table
      .integer('user_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');

    table.string('refresh_token_hash', 255).notNullable();

    table
      .timestamp('expires_at', {
        useTz: true,
      })
      .notNullable();

    table
      .timestamp('revoked_at', {
        useTz: true,
      })
      .nullable();

    table
      .timestamp('created_at', {
        useTz: true,
      })
      .notNullable()
      .defaultTo(knex.fn.now());

    table
      .timestamp('updated_at', {
        useTz: true,
      })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.index(['user_id']);
    table.index(['expires_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('auth_sessions');
}
