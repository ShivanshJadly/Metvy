import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";

const client = postgres({
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
});
export const db = drizzle(client);
