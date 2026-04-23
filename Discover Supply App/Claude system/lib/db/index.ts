import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Single shared connection pool for server use (service role ops only — prefer Supabase SSR client for user-scoped queries)
const client = postgres(connectionString, { prepare: false, max: 10 });
export const db = drizzle(client, { schema });
export { schema };
