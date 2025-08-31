import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from 'react';

import { PassphrasePrompt } from '@/components/passphrase/PassphrasePrompt';
import log from '@/lib/logging';
import { secureSession } from '@/lib/secure-session';

interface PassphrasePromptContextType {
  promptForPassphrase: (message?: string) => Promise<boolean>;
  isPromptVisible: boolean;
}

const PassphrasePromptContext =
  createContext<PassphrasePromptContextType | null>(null);

export function PassphrasePromptProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [promiseResolve, setPromiseResolve] = useState<
    ((value: boolean) => void) | null
  >(null);

  const promptForPassphrase = useCallback((msg?: string): Promise<boolean> => {
    return new Promise(async (resolve) => {
      // Check if we already have a passphrase
      const existingPassphrase = await secureSession.getPassphrase();
      if (existingPassphrase) {
        log.info('[PassphrasePrompt] Using existing passphrase');
        resolve(true);
        return;
      }

      // Show the prompt
      setMessage(msg || 'Please enter your passphrase to continue');
      setIsVisible(true);
      setPromiseResolve(() => resolve);
    });
  }, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    if (promiseResolve) {
      promiseResolve(false);
      setPromiseResolve(null);
    }
  }, [promiseResolve]);

  const handleSuccess = useCallback(() => {
    setIsVisible(false);
    if (promiseResolve) {
      promiseResolve(true);
      setPromiseResolve(null);
    }
  }, [promiseResolve]);

  return (
    <PassphrasePromptContext.Provider
      value={{ promptForPassphrase, isPromptVisible: isVisible }}
    >
      {children}
      <PassphrasePrompt
        visible={isVisible}
        message={message}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </PassphrasePromptContext.Provider>
  );
}

export function usePassphrasePrompt() {
  const context = useContext(PassphrasePromptContext);
  if (!context) {
    throw new Error(
      'usePassphrasePrompt must be used within PassphrasePromptProvider'
    );
  }
  return context;
}
