import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table
      .timestamp('phone_verified_at', {
        useTz: true,
      })
      .nullable();

    table.index(
      ['phone_verified_at'],
      'users_phone_verified_at_index',
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropIndex(
      ['phone_verified_at'],
      'users_phone_verified_at_index',
    );

    table.dropColumn('phone_verified_at');
  });
}