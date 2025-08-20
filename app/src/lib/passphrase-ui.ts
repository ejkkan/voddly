'use client';

export type GetPassphraseFn = (
  accountId: string,
  options?: { title?: string; message?: string; accountName?: string }
) => Promise<string>;

let resolver: GetPassphraseFn | null = null;

export function registerPassphraseResolver(fn: GetPassphraseFn) {
  resolver = fn;
}

export function unregisterPassphraseResolver(fn: GetPassphraseFn) {
  if (resolver === fn) resolver = null;
}

export function getRegisteredPassphraseResolver(): GetPassphraseFn | null {
  return resolver;
}
