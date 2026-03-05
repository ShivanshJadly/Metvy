import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { env } from "@/lib/env";

config({
  path: ".env",
});

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
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
  },
  schemaFilter: ["frontend"],
  verbose: true,
  strict: true,
});
