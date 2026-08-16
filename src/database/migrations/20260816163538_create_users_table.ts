import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('fullname', 255).notNullable();
    table.string('phone', 255).notNullable();
    table
      .specificType('created_at', 'timestamptz')
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .specificType('updated_at', 'timestamptz')
      .notNullable()
      .defaultTo(knex.fn.now());

    table.unique(['phone'], 'user_phone_unique');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('drop table if exists "user" cascade');
}
