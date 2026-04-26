import { db } from "./lib/db";
import { sql } from "drizzle-orm";

async function test() {
  try {
    console.log("Testing DB connection...");
    const result = await db.execute(sql`SELECT 1`);
    console.log("Connection successful:", result);
  } catch (err) {
    console.error("Connection failed:", err);
  } finally {
    process.exit();
  }
}

test();
