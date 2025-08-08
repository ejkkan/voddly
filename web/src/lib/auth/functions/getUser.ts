import { createServerFn } from "@tanstack/react-start";
import { getWebRequest } from "@tanstack/react-start/server";

export const getUser = createServerFn({ method: "GET" }).handler(async () => {
  const { headers } = getWebRequest();
  
  try {
    // Check for cookies to determine if user is authenticated
    const cookieHeader = headers.get('cookie') || '';
    
    // Simple check for better-auth session cookie
    const hasSessionCookie = cookieHeader.includes('better-auth.session_token') || 
                            cookieHeader.includes('session_token');
    
    if (hasSessionCookie) {
      // Return a minimal user object to indicate authentication
      // The actual user data will be fetched client-side
      return { authenticated: true };
    }
    
    return null;
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
});
