import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasDriver = await knex.schema.hasTable('driver');
  const hasDrivers = await knex.schema.hasTable('drivers');

  if (hasDriver && !hasDrivers) {
    await knex.schema.renameTable('driver', 'drivers');
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasDriver = await knex.schema.hasTable('driver');
  const hasDrivers = await knex.schema.hasTable('drivers');

  if (!hasDriver && hasDrivers) {
    await knex.schema.renameTable('drivers', 'driver');
  }
}
