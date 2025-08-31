'use client';

import { useCallback, useState } from 'react';

import { apiClient } from '@/lib/api-client';
import { deriveKeyUnified } from '@/lib/crypto-unified';
import { aesGcmDecrypt, decodeBase64 } from '@/lib/crypto-utils';
import { DeviceManager } from '@/lib/device-manager';
import { passphraseCache } from '@/lib/passphrase-cache';

export interface PassphraseValidationResult {
  passphrase: string;
  isValid: boolean;
}

/**
 * Hook that provides passphrase validation with real-time progress updates.
 * This performs the actual decryption to validate the passphrase,
 * showing accurate progress for the iterations (device-specific or account-level).
 */
export function usePassphraseWithProgress() {
  const [isValidating, setIsValidating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');

  const validatePassphraseWithProgress = useCallback(
    async (
      accountId: string,
      passphrase: string,
      onProgress?: (progress: number, message?: string) => void
    ): Promise<boolean> => {
      try {
        setIsValidating(true);
        setProgress(0);
        setProgressMessage('Initializing...');
        onProgress?.(0, 'Initializing...');

        const deviceManager = DeviceManager.getInstance();

        // Try device-specific validation first
        const deviceKeyData = await deviceManager.getDeviceKeyData(accountId);

        if (deviceKeyData) {
          // Device is registered - use device-specific key
          console.log('[Validation] Using device-specific key');

          const deviceSalt = decodeBase64(deviceKeyData.salt);
          const deviceIv = decodeBase64(deviceKeyData.iv);
          const deviceWrapped = decodeBase64(deviceKeyData.master_key_wrapped);
          const deviceIterations = deviceKeyData.kdf_iterations;

          // Check if iterations is defined (old cache might not have it)
          if (!deviceIterations) {
            console.log(
              '[Validation] Device key missing iterations, clearing cache and retrying...'
            );
            // Clear invalid cache
            const deviceManager = DeviceManager.getInstance();
            deviceManager.clearDeviceRegistration(accountId);
            // Fall through to re-fetch or re-register
            return validatePassphraseWithProgress(
              accountId,
              passphrase,
              onProgress
            );
          }

          onProgress?.(
            0.05,
            `Using device key (${deviceIterations.toLocaleString()} iterations)`
          );

          // Derive key with device-specific parameters
          const derivedKey = await deriveKeyUnified(
            passphrase,
            deviceSalt,
            deviceIterations,
            (prog, msg) => {
              const scaledProgress = 0.05 + prog * 0.9;
              setProgress(scaledProgress);
              setProgressMessage(
                msg || `Deriving key... ${Math.round(prog * 100)}%`
              );
              onProgress?.(
                scaledProgress,
                msg || `Deriving key... ${Math.round(prog * 100)}%`
              );
            }
          );

          // Try to decrypt the device-wrapped master key
          onProgress?.(0.97, 'Validating device key...');

          try {
            console.log('[Validation] Attempting device key decryption:', {
              wrappedLen: deviceWrapped.length,
              ivLen: deviceIv.length,
              saltLen: deviceSalt.length,
              keyLen: derivedKey.length,
              iterations: deviceIterations,
            });

            const decryptedMasterKey = aesGcmDecrypt(
              derivedKey,
              deviceIv,
              deviceWrapped
            );

            console.log('[Validation] Device key decryption successful:', {
              masterKeyLen: decryptedMasterKey.length,
            });

            // Success!
            setProgress(1);
            setProgressMessage('Device key validated');
            onProgress?.(1, 'Device key validated successfully');
            passphraseCache.set(accountId, passphrase);
            return true;
          } catch (error: any) {
            console.log(
              '[Validation] Device key validation failed:',
              error.message || error
            );
            console.log('[Validation] Device key details:', {
              accountId,
              deviceIterations,
              salt: deviceKeyData.salt,
              iv: deviceKeyData.iv,
              wrapped:
                deviceKeyData.master_key_wrapped?.substring(0, 50) + '...',
            });

            // Clear the bad cache and try again
            console.log('[Validation] Clearing device cache and retrying...');
            deviceManager.clearDeviceRegistration(accountId);
            return false;
          }
        } else {
          // No device key - try to register device
          console.log(
            '[Validation] No device key found, attempting registration...'
          );
          onProgress?.(0.02, 'Registering device...');

          try {
            const registeredKeyData = await deviceManager.registerDevice(
              accountId,
              passphrase,
              (msg) => onProgress?.(0.03, msg)
            );

            // Device registered successfully - validate with new device key
            const deviceSalt = decodeBase64(registeredKeyData.salt);
            const deviceIv = decodeBase64(registeredKeyData.iv);
            const deviceWrapped = decodeBase64(
              registeredKeyData.master_key_wrapped
            );

            onProgress?.(
              0.05,
              `Device registered (${registeredKeyData.kdf_iterations.toLocaleString()} iterations)`
            );

            const derivedKey = await deriveKeyUnified(
              passphrase,
              deviceSalt,
              registeredKeyData.kdf_iterations,
              (prog, msg) => {
                const scaledProgress = 0.05 + prog * 0.9;
                setProgress(scaledProgress);
                setProgressMessage(
                  msg || `Deriving key... ${Math.round(prog * 100)}%`
                );
                onProgress?.(
                  scaledProgress,
                  msg || `Deriving key... ${Math.round(prog * 100)}%`
                );
              }
            );

            // Validate
            try {
              aesGcmDecrypt(derivedKey, deviceIv, deviceWrapped);
              setProgress(1);
              setProgressMessage('Device registered and validated');
              onProgress?.(1, 'Device registered and validated successfully');
              passphraseCache.set(accountId, passphrase);
              return true;
            } catch {
              return false;
            }
          } catch (regError: any) {
            console.log(
              '[Validation] Device registration failed:',
              regError.message,
              regError
            );

            // Fall back to account-level validation
            onProgress?.(0.02, 'Using account encryption...');

            // Get account encryption data
            const { sources, keyData } = await apiClient.user.getSources({});

            if (!keyData) {
              throw new Error('No encryption data found for account');
            }

            const salt = decodeBase64(String(keyData.salt || ''));
            const iv = decodeBase64(String(keyData.iv || ''));
            const wrapped = decodeBase64(
              String(keyData.master_key_wrapped || '')
            );

            if (salt.length === 0 || iv.length === 0 || wrapped.length === 0) {
              throw new Error('Invalid encryption data');
            }

            const iterations =
              keyData.kdf_iterations || keyData.iterations || 100000;

            onProgress?.(
              0.05,
              `Using account key (${iterations.toLocaleString()} iterations)`
            );

            const personalKeyBytes = await deriveKeyUnified(
              passphrase,
              salt,
              iterations,
              (prog, msg) => {
                const scaledProgress = 0.05 + prog * 0.9;
                setProgress(scaledProgress);
                setProgressMessage(
                  msg || `Deriving key... ${Math.round(prog * 100)}%`
                );
                onProgress?.(
                  scaledProgress,
                  msg || `Deriving key... ${Math.round(prog * 100)}%`
                );
              }
            );

            // Validate with account key
            onProgress?.(0.97, 'Validating passphrase...');

            try {
              aesGcmDecrypt(personalKeyBytes, iv, wrapped);
              setProgress(1);
              setProgressMessage('Passphrase validated');
              onProgress?.(1, 'Passphrase validated successfully');
              passphraseCache.set(accountId, passphrase);
              return true;
            } catch {
              console.log('[Validation] Account key validation failed');
              return false;
            }
          }
        }
      } catch (error: any) {
        console.error('[Validation] Error:', error);
        throw error;
      } finally {
        setIsValidating(false);
      }
    },
    []
  );

  return {
    validatePassphraseWithProgress,
    isValidating,
    progress,
    progressMessage,
  };
}
