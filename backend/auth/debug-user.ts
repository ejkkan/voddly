import { api } from 'encore.dev/api';
import { userDB } from '../user/db';

// Debug endpoint to check what's in the database
export const debugUser = api(
  {
    expose: true,
    method: 'GET',
    path: '/debug/user/:userId',
  },
  async ({ userId }: { userId: string }) => {
    console.log('🔍 Debugging user:', userId);

    // Check if user exists in the "user" table (our custom table)
    const userInUserTable = await userDB.queryRow`
      SELECT * FROM "user" WHERE id = ${userId}
    `;

    // Check if user exists in better-auth tables
    const userInAuthTable = await userDB.queryRow`
      SELECT * FROM "user" WHERE id = ${userId}
    `;

    // Check sessions for this user
    const sessions = await userDB.queryAll`
      SELECT * FROM "session" WHERE "userId" = ${userId}
    `;

    // Check accounts for this user
    const accounts = await userDB.queryAll`
      SELECT * FROM "account" WHERE "userId" = ${userId}
    `;

    // List all tables to see what we have
    const tables = await userDB.queryAll`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    return {
      userId,
      userInUserTable,
      userInAuthTable,
      sessions,
      accounts,
      tables,
      timestamp: new Date().toISOString(),
    };
  }
);
