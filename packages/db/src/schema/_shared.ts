import { timestamp, uuid } from "drizzle-orm/pg-core";

/** Standard primary key — random UUID, generated in the DB. */
export const pk = () => uuid("id").primaryKey().defaultRandom();

/** created_at / updated_at every operational table carries. */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};
