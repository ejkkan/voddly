import { vi } from 'vitest';

// Stub Encore runtime environment expected variables to avoid N-API loading during unit tests.
if (!process.env.ENCORE_RUNTIME_LIB) {
  (process as any).env.ENCORE_RUNTIME_LIB = '/dev/null';
}