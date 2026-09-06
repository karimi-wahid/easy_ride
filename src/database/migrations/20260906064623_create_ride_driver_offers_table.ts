import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(
    'ride_driver_offers',
    (table) => {
      table
        .uuid('id')
        .primary()
        .defaultTo(
          knex.raw('gen_random_uuid()'),
        );

      table
        .uuid('ride_id')
        .notNullable()
        .references('id')
        .inTable('rides')
        .onDelete('CASCADE');

      table
        .uuid('driver_id')
        .notNullable()
        .references('id')
        .inTable('drivers')
        .onDelete('CASCADE');

      table
        .string('status', 20)
        .notNullable()
        .defaultTo('PENDING');

      table
        .timestamp('created_at', {
          useTz: false,
        })
        .notNullable()
        .defaultTo(knex.fn.now());

      table
        .timestamp('expires_at', {
          useTz: false,
        })
        .nullable();

      table
        .timestamp('responded_at', {
          useTz: false,
        })
        .nullable();

      table.index(
        ['ride_id'],
        'ride_driver_offers_ride_id_index',
      );

      table.index(
        ['driver_id'],
        'ride_driver_offers_driver_id_index',
      );

      table.index(
        ['status'],
        'ride_driver_offers_status_index',
      );

      table.index(
        ['expires_at'],
        'ride_driver_offers_expires_at_index',
      );

      table.unique(
        ['ride_id', 'driver_id'],
        'ride_driver_offers_ride_driver_unique',
      );
    },
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(
    'ride_driver_offers',
  );
}
