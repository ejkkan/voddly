import { createAuthClient } from "better-auth/react";
import { env } from "~/env/client";

const authClient = createAuthClient({
  baseURL: `${env.VITE_ENCORE_API_URL}/api/auth`, // Points to your Encore backend auth
});

export default authClient;
