import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('rides', (table) => {
    table
      .timestamp('matching_started_at', {
        useTz: true,
      })
      .nullable();

    table
      .timestamp('matching_expires_at', {
        useTz: true,
      })
      .nullable();

    table
      .timestamp('retry_at', {
        useTz: true,
      })
      .nullable();

    table
      .integer('matching_retry_count')
      .notNullable()
      .defaultTo(0);
  });

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS rides_matching_search_idx
    ON rides (
      status,
      matching_expires_at
    )
    WHERE driver_id IS NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP INDEX IF EXISTS rides_matching_search_idx
  `);

  await knex.schema.alterTable('rides', (table) => {
    table.dropColumn('matching_started_at');
    table.dropColumn('matching_expires_at');
    table.dropColumn('retry_at');
    table.dropColumn('matching_retry_count');
  });
}
