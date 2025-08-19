import React from 'react';
import { SQLiteProvider } from 'expo-sqlite';
import { migrateDbIfNeeded } from './migrations';

export function DbProvider({ children }: { children: React.ReactNode }) {
  return (
    <SQLiteProvider databaseName="catalog.db" onInit={migrateDbIfNeeded}>
      {children}
    </SQLiteProvider>
  );
}
