import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { Keyboard, Modal, Platform } from 'react-native';

import { Text, TouchableOpacity, View } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { passphraseCache } from '@/lib/passphrase-cache';
import { registerPassphraseResolver } from '@/lib/passphrase-ui';

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
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
        // Web: try native prompt first for simplicity
        if (
          Platform.OS === 'web' &&
          typeof window !== 'undefined' &&
          typeof window.prompt === 'function'
        ) {
          const resp = window.prompt(
            `${title || 'Decrypt'}\n\n${message || 'Enter your passphrase'}:`
          );
          if (!resp || resp.length < 6)
            return reject(new Error('Passphrase required'));
          passphraseCache.set(accountId, resp);
          return resolve(resp);
        }

        setValue('');
        setState({
          visible: true,
          title: title || 'Decrypt',
          message: message || 'Enter your passphrase',
          accountId,
          accountName,
          resolve,
          reject,
        });
      });
    },
    []
  );

  // Register a global resolver to be used by libraries that don't have direct access to the provider
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
      // no explicit unregister to avoid race when unmounting root
    };
  }, [requestPassphrase]);

  const onCancel = useCallback(() => {
    if (__DEV__) console.log('[passphrase] cancel pressed');
    const rej = state.reject;
    setSubmitting(false);
    Keyboard.dismiss();
    setState((s) => ({
      ...s,
      visible: false,
      resolve: undefined,
      reject: undefined,
    }));
    if (rej) setTimeout(() => rej(new Error('Passphrase required')), 0);
  }, [state.reject]);

  const onSubmit = useCallback(() => {
    if (__DEV__)
      console.log(
        '[passphrase] confirm pressed with value length',
        value.length
      );
    const pass = value.trim();
    if (pass.length < 6) return;
    const accountId = state.accountId!;
    setSubmitting(true);
    Keyboard.dismiss();
    passphraseCache.set(accountId, pass);
    const res = state.resolve;
    setState((s) => ({
      ...s,
      visible: false,
      resolve: undefined,
      reject: undefined,
    }));
    if (res) setTimeout(() => res(pass), 0);
    setSubmitting(false);
  }, [state.accountId, state.resolve, value]);

  const ctxValue = useMemo(() => ({ requestPassphrase }), [requestPassphrase]);

  return (
    <PassphraseContext.Provider value={ctxValue}>
      {children}
      <Modal
        visible={state.visible}
        transparent
        animationType="fade"
        onRequestClose={onCancel}
      >
        <View className="flex-1 items-center justify-center bg-black/40">
          <View className="w-[90%] rounded-xl bg-white p-4 dark:bg-neutral-900">
            <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {state.title}
            </Text>
            {!!state.accountName && (
              <Text className="mt-1 text-neutral-600 dark:text-neutral-400">
                Account: {state.accountName}
              </Text>
            )}
            <Text className="mt-2 text-neutral-700 dark:text-neutral-200">
              {state.message}
            </Text>
            <Input
              value={value}
              onChangeText={setValue}
              secureTextEntry
              placeholder="Passphrase"
            />
            <View className="mt-3 flex-row justify-end gap-3">
              <TouchableOpacity
                activeOpacity={0.7}
                className="rounded-xl border border-neutral-300 px-4 py-2 dark:border-neutral-700"
                onPress={onCancel}
                testID="passphrase-cancel"
                disabled={submitting}
              >
                <Text className="text-neutral-800 dark:text-neutral-200">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                className="rounded-xl bg-neutral-900 px-4 py-2"
                onPress={onSubmit}
                testID="passphrase-confirm"
                disabled={submitting}
              >
                <Text className="text-white">
                  {submitting ? 'Confirming…' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </PassphraseContext.Provider>
  );
}
