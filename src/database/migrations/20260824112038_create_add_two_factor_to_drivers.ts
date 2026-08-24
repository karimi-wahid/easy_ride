import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    'CREATE EXTENSION IF NOT EXISTS "pgcrypto"',
  );

  await knex.schema.createTable(
    'driver_two_factor',
    (table) => {
      table
        .uuid('id')
        .primary()
        .defaultTo(
          knex.raw('gen_random_uuid()'),
        );

      table
        .uuid('driver_id')
        .notNullable()
        .references('id')
        .inTable('drivers')
        .onDelete('CASCADE')
        .unique();

      table
        .timestamp('enabled', {
          useTz: true,
        })
        .nullable();

      table
        .string('secret', 255)
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
    },
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(
    'driver_two_factor',
  );
}