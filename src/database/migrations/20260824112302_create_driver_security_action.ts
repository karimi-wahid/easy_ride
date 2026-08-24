import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    'CREATE EXTENSION IF NOT EXISTS "pgcrypto"',
  );

  await knex.schema.createTable(
    'driver_security_action',
    (table) => {
      table
        .uuid('id')
        .primary()
        .defaultTo(
          knex.raw('gen_random_uuid()'),
        );

      table
        .uuid('driver_id')
        .nullable()
        .references('id')
        .inTable('drivers')
        .onDelete('CASCADE');

      table
        .timestamp('used_at', {
          useTz: true,
        })
        .nullable();

      table
        .timestamp('expires_at', {
          useTz: true,
        })
        .notNullable();

      table
        .string('secret', 255)
        .notNullable();

      table
        .string('event_type', 100)
        .notNullable();

      table
        .string('ip_address', 45)
        .nullable();

      table
        .text('user_agent')
        .nullable();

      table
        .text('metadata')
        .nullable();

      table
        .timestamp('created_at', {
          useTz: true,
        })
        .notNullable()
        .defaultTo(knex.fn.now());

      table.index(
        ['driver_id'],
        'driver_security_action_driver_id_index',
      );

      table.index(
        ['secret'],
        'driver_security_action_secret_index',
      );

      table.index(
        ['event_type'],
        'driver_security_action_event_type_index',
      );

      table.index(
        ['expires_at'],
        'driver_security_action_expires_at_index',
      );
    },
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(
    'driver_security_action',
  );
}