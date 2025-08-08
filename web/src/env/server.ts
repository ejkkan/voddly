import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  server: {
    VITE_BASE_URL: z.url().default("http://localhost:3000"),
    ENCORE_API_URL: z.url().default("http://localhost:4000"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  },
  runtimeEnv: process.env,
});
