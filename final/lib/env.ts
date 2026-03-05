import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.string(),
    AUTH_SECRET: z.string().min(1),
    GOOGLE_CLOUD_PROJECT_ID: z.string().min(1),
    GOOGLE_CLOUD_STORAGE_BUCKET: z.string().min(1),
    ADMIN_EMAIL_DOMAIN: z.string().min(1),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
    DB_HOST: z.string(),
    DB_PORT: z.number(),
    DB_USER: z.string(),
    DB_PASS: z.string(),
    DB_NAME: z.string(),
    DB_CONNECTION_NAME: z.string().optional(),
  },
  client: {},
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    AUTH_SECRET: process.env.AUTH_SECRET,
    GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID,
    GOOGLE_CLOUD_STORAGE_BUCKET: process.env.GOOGLE_CLOUD_STORAGE_BUCKET,
    ADMIN_EMAIL_DOMAIN: process.env.ADMIN_EMAIL_DOMAIN,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    DB_HOST: process.env.DB_HOST,
    DB_PORT: Number.parseInt(process.env.DB_PORT || "5432", 10),
    DB_USER: process.env.DB_USER,
    DB_PASS: process.env.DB_PASS,
    DB_NAME: process.env.DB_NAME,
    DB_CONNECTION_NAME: process.env.DB_CONNECTION_NAME,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});
