import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { apiClient } from '@/lib/api-client';
import { useSession } from '@/lib/auth/hooks';
import { getDeviceInfo } from '@/lib/device-id';
import { notify } from '@/lib/toast';

export default function DeviceSetupScreen() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [requiresPassphrase, setRequiresPassphrase] = useState(false);

  useEffect(() => {
    checkDeviceStatus();
  }, []);

  const checkDeviceStatus = async () => {
    try {
      if (!session?.data?.accountId) {
        console.log('[DeviceSetup] No account ID available');
        router.replace('/signin');
        return;
      }

      const deviceInfo = getDeviceInfo();
      const result = await apiClient.user.checkDevice({
        accountId: session.data.accountId,
        deviceId: deviceInfo.deviceId,
      });

      if (result.isRegistered) {
        // Device is already registered
        notify.success('Device registered');
        router.replace('/(app)');
      } else if (result.requiresPassphrase) {
        // Need passphrase to register
        setRequiresPassphrase(true);
        setLoading(false);
        // TODO: Show passphrase modal to register device
        router.replace('/passphrase-setup');
      } else if (!result.canAutoRegister) {
        // Device limit reached
        notify.error('Device Limit Reached', {
          description: `You have ${result.deviceCount} of ${result.maxDevices} devices registered.`,
          duration: 8000,
        });
        router.replace('/settings/devices');
      }
    } catch (error) {
      console.error('[DeviceSetup] Error checking device:', error);
      notify.error('Failed to check device status');
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.text}>Checking device status...</Text>
      </View>
    );
  }

  if (requiresPassphrase) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Device Registration Required</Text>
        <Text style={styles.text}>
          This device needs to be registered with your passphrase.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Setting up device...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },
});
