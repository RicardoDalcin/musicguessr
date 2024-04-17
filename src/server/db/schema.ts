import { pgTable, serial, text, varchar, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  fullName: text('full_name'),
  phone: varchar('phone', { length: 256 }),
});

export const lobbies = pgTable('lobbies', {
  id: uuid('id').primaryKey().defaultRandom(),
});
