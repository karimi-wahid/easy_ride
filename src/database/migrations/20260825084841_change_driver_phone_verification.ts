import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('drivers', (table) => {
    table.dropColumn('phone_verified');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('drivers', (table) => {
    table
      .boolean('phone_verified')
      .notNullable()
      .defaultTo(false);
  });
}