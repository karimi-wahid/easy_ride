import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE EXTENSION IF NOT EXISTS postgis;
  `);

  await knex.schema.alterTable('rides', (table) => {
    table.specificType(
      'pickup_location',
      'geography(Point,4326)',
    );

    table.specificType(
      'destination_location',
      'geography(Point,4326)',
    );
  });

  await knex.schema.alterTable('drivers', (table) => {
    table
      .string('status', 20)
      .notNullable()
      .defaultTo('OFFLINE');

    table.specificType(
      'location',
      'geography(Point,4326)',
    );

    table
      .timestamp('last_location_update', {
        useTz: false,
      })
      .nullable();
  });

  await knex.raw(`
    CREATE INDEX rides_pickup_location_gist_idx
    ON rides
    USING GIST (pickup_location);
  `);

  await knex.raw(`
    CREATE INDEX rides_destination_location_gist_idx
    ON rides
    USING GIST (destination_location);
  `);

  await knex.raw(`
    CREATE INDEX drivers_location_gist_idx
    ON drivers
    USING GIST (location);
  `);

  await knex.raw(`
    CREATE INDEX drivers_status_idx
    ON drivers (status);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP INDEX IF EXISTS drivers_status_idx;
  `);

  await knex.raw(`
    DROP INDEX IF EXISTS drivers_location_gist_idx;
  `);

  await knex.raw(`
    DROP INDEX IF EXISTS rides_destination_location_gist_idx;
  `);

  await knex.raw(`
    DROP INDEX IF EXISTS rides_pickup_location_gist_idx;
  `);

  await knex.schema.alterTable('drivers', (table) => {
    table.dropColumn('last_location_update');
    table.dropColumn('location');
    table.dropColumn('status');
  });

  await knex.schema.alterTable('rides', (table) => {
    table.dropColumn('destination_location');
    table.dropColumn('pickup_location');
  });
}
