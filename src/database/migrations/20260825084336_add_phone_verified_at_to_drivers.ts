import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('drivers', (table) => {
    table
      .timestamp('phone_verified_at', {
        useTz: true,
      })
      .nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('drivers', (table) => {
    table.dropColumn('phone_verified_at');
  });
}