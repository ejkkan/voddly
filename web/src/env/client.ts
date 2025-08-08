import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_BASE_URL: z.url().default("http://localhost:3000"),
    VITE_ENCORE_API_URL: z.url().default("http://localhost:4000"),
    VITE_APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
    VITE_ENABLE_DEVTOOLS: z.boolean().default(true),
  },
  runtimeEnv: import.meta.env,
});
