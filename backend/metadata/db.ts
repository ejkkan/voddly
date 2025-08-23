import { SQLDatabase } from 'encore.dev/storage/sqldb';

export const metadataDB = new SQLDatabase('metadata', {
  migrations: './migrations',
});


