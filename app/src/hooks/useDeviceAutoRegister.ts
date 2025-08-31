import { useEffect } from 'react';

import { useSession } from '@/lib/auth/hooks';
import log from '@/lib/logging';
import { secureSession } from '@/lib/secure-session';

/**
 * Hook that monitors if device needs registration and ensures
 * passphrase is available for auto-registration
 */
export function useDeviceAutoRegister() {
  const { data: session } = useSession();

  useEffect(() => {
    const checkAndSetupDevice = async () => {
      try {
        // Only proceed if we have a user session
        if (!session?.data?.user) {
          return;
        }

        // Check if device is already marked as registered
        const isRegistered = await secureSession.isDeviceRegistered();
        const currentAccountId = await secureSession.getAccountId();

        // If we switched accounts, reset the device registration state
        if (
          session.data.accountId &&
          currentAccountId !== session.data.accountId
        ) {
          log.info(
            '[DeviceAutoRegister] Account changed, resetting device state'
          );
          await secureSession.setDeviceRegistered(
            false,
            session.data.accountId
          );
        }

        // Check if we have a passphrase stored
        const hasPassphrase = !!(await secureSession.getPassphrase());

        log.debug('[DeviceAutoRegister] Status check', {
          isRegistered,
          hasPassphrase,
          accountId: session.data.accountId,
        });

        // If device is not registered and we don't have a passphrase,
        // the user will need to go through passphrase setup
        if (!isRegistered && !hasPassphrase && session.data.accountId) {
          log.info(
            '[DeviceAutoRegister] Device needs registration and passphrase'
          );
          // The app should redirect to passphrase setup
        }
      } catch (error) {
        log.error('[DeviceAutoRegister] Error checking device status', {
          error,
        });
      }
    };

    checkAndSetupDevice();
  }, [session?.data?.user, session?.data?.accountId]);

  return {
    markDeviceRegistered: async (accountId: string) => {
      await secureSession.setDeviceRegistered(true, accountId);
      log.info('[DeviceAutoRegister] Device marked as registered', {
        accountId,
      });
    },
    clearDeviceRegistration: async () => {
      await secureSession.setDeviceRegistered(false);
      log.info('[DeviceAutoRegister] Device registration cleared');
    },
  };
}
