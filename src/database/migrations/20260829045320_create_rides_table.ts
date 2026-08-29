import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('rides', (table) => {
    table.uuid('id').primary();

    table.uuid('user_id').notNullable();

    table.uuid('driver_id').nullable();

    table.double('pickup_lat').notNullable();
    table.double('pickup_lng').notNullable();

    table.double('destination_lat').notNullable();
    table.double('destination_lng').notNullable();

    table.double('estimated_distance_km').nullable();

    table.double('estimated_duration_minutes').nullable();

    table.double('estimated_fare').nullable();

    table
      .string('status')
      .notNullable()
      .defaultTo('searching');

    table
      .timestamp('created_at')
      .notNullable()
      .defaultTo(knex.fn.now());

    table
      .timestamp('updated_at')
      .notNullable()
      .defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('rides');
}
