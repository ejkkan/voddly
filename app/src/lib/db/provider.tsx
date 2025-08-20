import React from 'react';
import { SQLiteProvider } from 'expo-sqlite';
import { Platform } from 'react-native';
import { migrateDbIfNeeded } from './migrations';

export function DbProvider({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    // On web we manage the async DB connection manually via openDb();
    // Avoid mounting a second provider/connection.
    return <>{children}</>;
  }
  return (
    <SQLiteProvider databaseName="catalog.db" onInit={migrateDbIfNeeded}>
      {children}
    </SQLiteProvider>
  );
}
