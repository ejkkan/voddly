import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { usePassphraseWithProgress } from '@/hooks/usePassphraseWithProgress';
import { useCacheInvalidation } from '@/lib/cache-invalidation';
import { passphraseCache } from '@/lib/passphrase-cache';
import { registerPassphraseResolver } from '@/lib/passphrase-ui';

import { ImprovedPassphraseModal } from './ImprovedPassphraseModal';

type PromptState = {
  visible: boolean;
  title?: string;
  message?: string;
  accountId?: string;
  accountName?: string;
  resolve?: (value: string) => void;
  reject?: (reason?: any) => void;
};

const PassphraseContext = createContext<{
  requestPassphrase: (args: {
    accountId: string;
    title?: string;
    message?: string;
    accountName?: string;
  }) => Promise<string>;
} | null>(null);

export function usePassphraseUI() {
  const ctx = useContext(PassphraseContext);
  if (!ctx) throw new Error('PassphraseProvider missing');
  return ctx;
}

export function PassphraseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<PromptState>({ visible: false });
  const { validatePassphraseWithProgress } = usePassphraseWithProgress();
  const { invalidateAfterPassphrase } = useCacheInvalidation();

  const requestPassphrase = useCallback(
    ({
      accountId,
      title,
      message,
      accountName,
    }: {
      accountId: string;
      title?: string;
      message?: string;
      accountName?: string;
    }) => {
      const cached = passphraseCache.get(accountId);
      if (cached) return Promise.resolve(cached);

      return new Promise<string>((resolve, reject) => {
        // Web: Use improved modal for consistent UX
        setState({
          visible: true,
          title: title || 'Decrypt Source',
          message: message || 'Enter your passphrase to decrypt',
          accountId,
          accountName,
          resolve,
          reject,
        });
      });
    },
    []
  );

  // Register a global resolver to be used by libraries
  React.useEffect(() => {
    const fn = async (
      accountId: string,
      options?: { title?: string; message?: string; accountName?: string }
    ) =>
      requestPassphrase({
        accountId,
        title: options?.title,
        message: options?.message,
        accountName: options?.accountName,
      });
    registerPassphraseResolver(fn);
    return () => {
      // unregister by setting same function only if API supported
      // or rely on provider unmount not to use the old resolver
    };
  }, [requestPassphrase]);

  const handleSubmit = useCallback(
    async (
      passphrase: string,
      onProgress?: (progress: number, message?: string) => void
    ) => {
      if (!state.resolve || !state.accountId) return;

      // Validate passphrase length
      if (passphrase.length < 6) {
        throw new Error('Passphrase must be at least 6 characters');
      }

      // Perform actual decryption validation with real progress
      const isValid = await validatePassphraseWithProgress(
        state.accountId,
        passphrase,
        onProgress
      );

      if (!isValid) {
        throw new Error('Invalid passphrase - decryption failed');
      }

      // Passphrase is valid and cached
      state.resolve(passphrase);

      // Invalidate caches to trigger refetch of content
      invalidateAfterPassphrase(state.accountId!);

      // Close modal after success
      setState({ visible: false });
    },
    [state, validatePassphraseWithProgress, invalidateAfterPassphrase]
  );

  const handleCancel = useCallback(() => {
    if (state.reject) {
      state.reject(new Error('User cancelled passphrase input'));
    }
    setState({ visible: false });
  }, [state]);

  const context = useMemo(() => ({ requestPassphrase }), [requestPassphrase]);

  return (
    <PassphraseContext.Provider value={context}>
      {children}
      <ImprovedPassphraseModal
        visible={state.visible}
        title={state.title || 'Decrypt Source'}
        message={state.message || 'Enter your passphrase to decrypt'}
        accountName={state.accountName}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </PassphraseContext.Provider>
  );
}
