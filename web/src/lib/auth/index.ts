import { serverOnly } from "@tanstack/react-start";
import { createAuthClient } from "better-auth/client";
import { env } from "~/env/server";

// Create a server-side auth client that points to Encore backend
export const auth = serverOnly(() => 
  createAuthClient({
    baseURL: `${env.ENCORE_API_URL}/api/auth`, // Points to your Encore backend
  })
);
