/**
 * Example component showing how to use source credentials on tvOS
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Alert, ActivityIndicator } from 'react-native';
import { tvosCredentials, type SourceInfo } from '../lib/source-credentials-tvos';

// Example source info (normally would come from your API)
const EXAMPLE_SOURCE_INFO: SourceInfo = {
  source: {
    id: 'source-1',
    name: 'My IPTV Source',
    encrypted_config: '', // Base64 encrypted config from backend
    config_iv: '', // Base64 IV from backend
  },
  keyData: {
    master_key_wrapped: '', // Base64 wrapped key from backend
    salt: '', // Base64 salt from backend
    iv: '', // Base64 IV from backend
    iterations: 1000, // Low for tvOS performance
  },
  account: {
    id: 'account-1',
    name: 'My Account',
  },
};

export function SecureVideoPlayer() {
  const [passphrase, setPassphrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [credentials, setCredentials] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDecrypt = async () => {
    if (!passphrase) {
      Alert.alert('Error', 'Please enter a passphrase');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // This will:
      // 1. Derive key (takes ~1 second on tvOS with 1000 iterations)
      // 2. Cache everything for 30 minutes
      // 3. Return decrypted credentials
      const creds = await tvosCredentials.get(EXAMPLE_SOURCE_INFO, passphrase);
      
      setCredentials(creds);
      console.log('Decrypted credentials:', creds);
      
      // Now you can use creds.server, creds.username, creds.password
      // to build your stream URL
      
    } catch (err: any) {
      setError(err.message || 'Failed to decrypt credentials');
      console.error('Decryption error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCache = async () => {
    await tvosCredentials.clearCache();
    setCredentials(null);
    Alert.alert('Cache Cleared', 'All cached credentials have been removed');
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>
        Secure Video Player
      </Text>

      {!credentials ? (
        <>
          <TextInput
            placeholder="Enter passphrase"
            value={passphrase}
            onChangeText={setPassphrase}
            secureTextEntry
            style={{
              borderWidth: 1,
              borderColor: '#ccc',
              padding: 10,
              marginBottom: 20,
              fontSize: 18,
            }}
          />

          {isLoading ? (
            <ActivityIndicator size="large" />
          ) : (
            <Button title="Decrypt Credentials" onPress={handleDecrypt} />
          )}

          {error && (
            <Text style={{ color: 'red', marginTop: 10 }}>{error}</Text>
          )}
        </>
      ) : (
        <>
          <Text style={{ fontSize: 18, marginBottom: 10 }}>
            ✅ Credentials Decrypted!
          </Text>
          <Text>Server: {credentials.server}</Text>
          <Text>Username: {credentials.username}</Text>
          <Text style={{ marginBottom: 20 }}>
            Password: {'*'.repeat(credentials.password?.length || 0)}
          </Text>

          <Button title="Clear Cache" onPress={handleClearCache} />
          
          <Text style={{ marginTop: 20, color: '#666' }}>
            Credentials are cached for 30 minutes.
            No CPU spike on subsequent uses!
          </Text>
        </>
      )}
    </View>
  );
}

/**
 * Performance on tvOS:
 * - First decryption: ~1 second (1000 PBKDF2 iterations)
 * - Cached calls: <1ms
 * - Cache duration: 30 minutes
 * - No CPU spikes after initial derivation
 */