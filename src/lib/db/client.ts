import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DbInstance = NeonHttpDatabase<typeof schema>;

let _db: DbInstance | null = null;

/**
 * Get the Drizzle database instance.
 * Lazy-initialized on first call to avoid crashing during `next build`
 * when DATABASE_URL is not set.
 */
export function getDb(): DbInstance {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required. Get one from https://console.neon.tech");
    }
    _db = drizzle(process.env.DATABASE_URL, { schema });
  }
  return _db;
}
