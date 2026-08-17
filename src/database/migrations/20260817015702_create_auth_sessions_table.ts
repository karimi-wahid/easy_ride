import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_session', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('gen_random_uuid()'));

    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');

    table
      .string('refresh_token_hash', 255)
      .notNullable();

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
      .string('ip_address', 45)
      .nullable();

    table
      .text('user_agent')
      .nullable();

    table
      .timestamp('created_at', {
        useTz: true,
      })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.index(
      ['user_id'],
      'user_session_user_id_index',
    );

    table.index(
      ['expires_at'],
      'user_session_expires_at_index',
    );

    table.index(
      ['revoked_at'],
      'user_session_revoked_at_index',
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_session');
}