'use client';

import React from 'react';

import { purgeOtherAccounts } from './purge';
import { useActiveAccountId } from '@/hooks/ui/useAccounts';

export function AccountDbGuard() {
  const { accountId, isLoading } = useActiveAccountId();

  React.useEffect(() => {
    if (isLoading) return;
    purgeOtherAccounts(accountId).catch(() => {});
  }, [isLoading, accountId]);

  return null;
}
