import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function requireD1(database?: D1Database): D1Database {
  if (!database) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let the control plane inject the real binding before using the database."
    );
  }
  return database;
}

export function getDb(database?: D1Database) {
  return drizzle(requireD1(database), { schema });
}
