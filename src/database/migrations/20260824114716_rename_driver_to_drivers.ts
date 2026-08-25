import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.renameTable('driver', 'drivers');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.renameTable('drivers', 'driver');
}