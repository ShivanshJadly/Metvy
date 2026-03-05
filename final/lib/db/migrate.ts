import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "@/lib/env";
// biome-ignore lint: Allow namespace import
import * as schema from "./schema";

const runMigrate = async () => {
  const connection = postgres({
    host: env.DB_CONNECTION_NAME
      ? `/cloudsql/${env.DB_CONNECTION_NAME}`
      : env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    ssl: env.DB_CONNECTION_NAME
      ? false // Unix socket doesn't need SSL
      : env.NODE_ENV === "production"
        ? { rejectUnauthorized: false } // Direct IP in production needs SSL
        : false, // Local proxy doesn't need SSL
    max: 1,
  });
  const db = drizzle(connection, {
    schema,
    logger: true,
  });

  // console.log("⏳ Running migrations...");

  // const start = Date.now();
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  // const end = Date.now();

  // console.log("✅ Migrations completed in", end - start, "ms");
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error("❌ Migration failed");
  console.error(err);
  process.exit(1);
});
