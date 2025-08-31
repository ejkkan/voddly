import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { apiClient } from '@/lib/api-client';
import { useSession } from '@/lib/auth/hooks';
import { getDeviceInfo } from '@/lib/device-id';
import { notify } from '@/lib/toast';

export function useDeviceRegistration() {
  const { data: session } = useSession();
  const [isChecking, setIsChecking] = useState(true);
  const [needsRegistration, setNeedsRegistration] = useState(false);

  useEffect(() => {
    checkDeviceRegistration();
  }, [session?.data?.accountId]);

  const checkDeviceRegistration = async () => {
    try {
      // Only check if we have an account
      if (!session?.data?.accountId) {
        setIsChecking(false);
        return;
      }

      const deviceInfo = getDeviceInfo();

      // Check device status
      const result = await apiClient.user.checkDevice({
        accountId: session.data.accountId,
        deviceId: deviceInfo.deviceId,
      });

      if (!result.isRegistered) {
        if (result.requiresPassphrase && result.canAutoRegister) {
          // Device needs to be registered with passphrase
          setNeedsRegistration(true);
          notify.info('Device Registration Required', {
            description:
              'Please enter your passphrase to register this device.',
            duration: 5000,
          });
          // Navigate to passphrase setup
          router.push('/passphrase-setup');
        } else if (!result.canAutoRegister) {
          // Device limit reached
          notify.error('Device Limit Reached', {
            description: `You have ${result.deviceCount} of ${result.maxDevices} devices registered.`,
            duration: 8000,
            action: {
              label: 'Manage Devices',
              onPress: () => router.push('/settings/devices'),
            },
          });
        }
      }
    } catch (error) {
      console.error('[DeviceRegistration] Error checking device:', error);
    } finally {
      setIsChecking(false);
    }
  };

  return {
    isChecking,
    needsRegistration,
    checkDeviceRegistration,
  };
}
