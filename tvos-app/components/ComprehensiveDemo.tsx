import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Alert, Platform } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedButton } from './ThemedButton';
import { PassphraseInputOptimized } from './PassphraseInput-Optimized';
import { authManager } from '../lib/auth-manager';
import { securePassphraseManager } from '../lib/passphrase-manager-secure';
import { integratedApiClient } from '../lib/api-client-integrated';
import { sourceCacheManager } from '../lib/source-cache-manager';
import { secureStorage } from '../lib/secure-storage';

interface DemoState {
  currentView: 'main' | 'auth' | 'passphrase' | 'sources' | 'cache';
  isLoading: boolean;
  status: string;
  authStatus: string;
  passphraseStatus: string;
  sourcesStatus: string;
  cacheStatus: string;
  showPassphraseInput: boolean;
  user: any | null;
  sources: any[];
  cacheStats: any | null;
}

export function ComprehensiveDemo() {
  const [state, setState] = useState<DemoState>({
    currentView: 'main',
    isLoading: false,
    status: 'Ready',
    authStatus: 'Not authenticated',
    passphraseStatus: 'No passphrase set',
    sourcesStatus: 'No sources loaded',
    cacheStatus: 'Cache not initialized',
    showPassphraseInput: false,
    user: null,
    sources: [],
    cacheStats: null,
  });

  // Initialize managers
  useEffect(() => {
    const initialize = async () => {
      try {
        setState(prev => ({ ...prev, status: 'Initializing...' }));
        
        // Initialize auth manager
        await authManager.initialize();
        
        // Initialize secure storage
        await secureStorage.initialize();
        
        // Initialize source cache
        await sourceCacheManager.initialize();
        
        // Update status
        updateAllStatus();
        
        setState(prev => ({ ...prev, status: 'Initialized successfully' }));
      } catch (error) {
        console.error('[Demo] Initialization failed:', error);
        setState(prev => ({ ...prev, status: `Initialization failed: ${error.message}` }));
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      authManager.cleanup();
      sourceCacheManager.cleanup();
    };
  }, []);

  const updateAllStatus = useCallback(async () => {
    try {
      // Auth status
      const isAuthenticated = authManager.isAuthenticated();
      const user = authManager.getCurrentUser();
      
      setState(prev => ({
        ...prev,
        authStatus: isAuthenticated ? `Authenticated as ${user?.email || user?.id}` : 'Not authenticated',
        user,
      }));

      // Cache stats
      const cacheStats = await sourceCacheManager.getCacheStats();
      setState(prev => ({
        ...prev,
        cacheStats,
        cacheStatus: `${cacheStats.totalSources} sources, ${Math.round(cacheStats.totalSize / 1024)}KB, ${Math.round(cacheStats.hitRate * 100)}% hit rate`,
      }));

      // Passphrase status (simplified)
      const passphraseStatus = 'Passphrase system ready';
      setState(prev => ({ ...prev, passphraseStatus }));

    } catch (error) {
      console.error('[Demo] Failed to update status:', error);
    }
  }, []);

  // Demo functions
  const handleDemoAuth = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, status: 'Testing authentication...' }));
    
    try {
      // Demo login (this would normally require real credentials)
      Alert.alert(
        'Demo Authentication',
        'This would normally require real credentials. For demo purposes, we\'ll simulate authentication.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Demo Login', 
            onPress: async () => {
              try {
                // Simulate successful auth
                setState(prev => ({ 
                  ...prev, 
                  authStatus: 'Demo authenticated',
                  user: { id: 'demo-user', email: 'demo@voddly.com' },
                  status: 'Demo authentication successful'
                }));
              } catch (error) {
                setState(prev => ({ ...prev, status: `Auth failed: ${error.message}` }));
              }
            }
          }
        ]
      );
    } catch (error) {
      setState(prev => ({ ...prev, status: `Auth error: ${error.message}` }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const handleDemoPassphrase = useCallback(() => {
    setState(prev => ({ ...prev, showPassphraseInput: true }));
  }, []);

  const handlePassphraseSubmit = useCallback(async (
    passphrase: string,
    onProgress?: (progress: number, message?: string) => void
  ) => {
    try {
      // Demo passphrase validation
      onProgress?.(0.1, 'Starting validation...');
      
      // Simulate validation process
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        onProgress?.(0.1 + (i * 0.08), `Processing... ${Math.round((0.1 + (i * 0.08)) * 100)}%`);
      }
      
      onProgress?.(0.9, 'Finalizing...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (passphrase === '000000') {
        throw new Error('Demo error: Invalid passphrase');
      }
      
      onProgress?.(1.0, 'Validation complete!');
      
      setState(prev => ({ 
        ...prev, 
        passphraseStatus: `Passphrase "${passphrase}" validated successfully`,
        showPassphraseInput: false,
        status: 'Passphrase validation successful'
      }));
      
    } catch (error) {
      throw error;
    }
  }, []);

  const handlePassphraseCancel = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      showPassphraseInput: false,
      status: 'Passphrase validation cancelled'
    }));
  }, []);

  const handleDemoSources = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, status: 'Loading sources...' }));
    
    try {
      // Demo sources data
      const demoSources = [
        {
          id: 'demo-1',
          name: 'Demo IPTV Source',
          type: 'iptv',
          url: 'http://demo.m3u8',
          encrypted: true,
          lastUpdated: Date.now(),
        },
        {
          id: 'demo-2',
          name: 'Demo File Source',
          type: 'file',
          url: '/path/to/demo/file.mp4',
          encrypted: false,
          lastUpdated: Date.now(),
        },
      ];

      // Cache the sources
      await sourceCacheManager.cacheSources(demoSources);
      
      setState(prev => ({ 
        ...prev, 
        sources: demoSources,
        sourcesStatus: `${demoSources.length} demo sources loaded and cached`,
        status: 'Demo sources loaded successfully'
      }));
      
      // Update cache stats
      await updateAllStatus();
      
    } catch (error) {
      setState(prev => ({ ...prev, status: `Sources error: ${error.message}` }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [updateAllStatus]);

  const handleDemoCache = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, status: 'Testing cache operations...' }));
    
    try {
      // Test cache operations
      await secureStorage.setItem('demo_key', 'Demo encrypted value');
      const retrieved = await secureStorage.getItem('demo_key');
      
      if (retrieved === 'Demo encrypted value') {
        setState(prev => ({ 
          ...prev, 
          status: 'Cache test successful - encryption/decryption working'
        }));
      } else {
        setState(prev => ({ 
          ...prev, 
          status: 'Cache test failed - encryption/decryption issue'
        }));
      }
      
      await updateAllStatus();
      
    } catch (error) {
      setState(prev => ({ ...prev, status: `Cache error: ${error.message}` }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [updateAllStatus]);

  const handleClearAll = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, status: 'Clearing all data...' }));
    
    try {
      await sourceCacheManager.clearCache();
      await secureStorage.clearAll();
      
      setState(prev => ({
        ...prev,
        authStatus: 'Not authenticated',
        passphraseStatus: 'No passphrase set',
        sourcesStatus: 'No sources loaded',
        cacheStatus: 'Cache cleared',
        user: null,
        sources: [],
        cacheStats: null,
        status: 'All data cleared successfully'
      }));
      
    } catch (error) {
      setState(prev => ({ ...prev, status: `Clear error: ${error.message}` }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const renderMainView = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, gap: 15 }}
      showsVerticalScrollIndicator={true}
    >
      <ThemedText style={{ fontSize: 28, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 20 }}>
        Voddly tvOS Security Demo
      </ThemedText>

      {/* Status Display */}
      <View style={{ backgroundColor: '#1a1a1a', padding: 15, borderRadius: 10, marginBottom: 20 }}>
        <ThemedText style={{ fontSize: 16, color: '#4a9eff', marginBottom: 10 }}>System Status</ThemedText>
        <ThemedText style={{ fontSize: 14, color: '#fff', marginBottom: 5 }}>Overall: {state.status}</ThemedText>
        <ThemedText style={{ fontSize: 14, color: '#aaa', marginBottom: 5 }}>Auth: {state.authStatus}</ThemedText>
        <ThemedText style={{ fontSize: 14, color: '#aaa', marginBottom: 5 }}>Passphrase: {state.passphraseStatus}</ThemedText>
        <ThemedText style={{ fontSize: 14, color: '#aaa', marginBottom: 5 }}>Sources: {state.sourcesStatus}</ThemedText>
        <ThemedText style={{ fontSize: 14, color: '#aaa' }}>Cache: {state.cacheStatus}</ThemedText>
      </View>

      {/* Demo Buttons */}
      <View style={{ gap: 15 }}>
        <ThemedButton
          onPress={handleDemoAuth}
          disabled={state.isLoading}
          style={{ backgroundColor: '#4a9eff', padding: 15, borderRadius: 10 }}
          textStyle={{ color: '#fff', fontSize: 18, textAlign: 'center' }}
        >
          🔐 Test Authentication System
        </ThemedButton>

        <ThemedButton
          onPress={handleDemoPassphrase}
          disabled={state.isLoading}
          style={{ backgroundColor: '#00c851', padding: 15, borderRadius: 10 }}
          textStyle={{ color: '#fff', fontSize: 18, textAlign: 'center' }}
        >
          🔑 Test Passphrase Validation
        </ThemedButton>

        <ThemedButton
          onPress={handleDemoSources}
          disabled={state.isLoading}
          style={{ backgroundColor: '#ff6b35', padding: 15, borderRadius: 10 }}
          textStyle={{ color: '#fff', fontSize: 18, textAlign: 'center' }}
        >
          📺 Test Source Management
        </ThemedButton>

        <ThemedButton
          onPress={handleDemoCache}
          disabled={state.isLoading}
          style={{ backgroundColor: '#9c27b0', padding: 15, borderRadius: 10 }}
          textStyle={{ color: '#fff', fontSize: 18, textAlign: 'center' }}
        >
          💾 Test Encrypted Cache
        </ThemedButton>

        <ThemedButton
          onPress={handleClearAll}
          disabled={state.isLoading}
          style={{ backgroundColor: '#f44336', padding: 15, borderRadius: 10 }}
          textStyle={{ color: '#fff', fontSize: 18, textAlign: 'center' }}
        >
          🗑️ Clear All Data
        </ThemedButton>
      </View>

      {/* Cache Stats */}
      {state.cacheStats && (
        <View style={{ backgroundColor: '#1a1a1a', padding: 15, borderRadius: 10, marginTop: 20 }}>
          <ThemedText style={{ fontSize: 16, color: '#4a9eff', marginBottom: 10 }}>Cache Statistics</ThemedText>
          <ThemedText style={{ fontSize: 12, color: '#aaa', marginBottom: 3 }}>
            Sources: {state.cacheStats.totalSources}
          </ThemedText>
          <ThemedText style={{ fontSize: 12, color: '#aaa', marginBottom: 3 }}>
            Size: {Math.round(state.cacheStats.totalSize / 1024)}KB
          </ThemedText>
          <ThemedText style={{ fontSize: 12, color: '#aaa', marginBottom: 3 }}>
            Hit Rate: {Math.round(state.cacheStats.hitRate * 100)}%
          </ThemedText>
          <ThemedText style={{ fontSize: 12, color: '#aaa' }}>
            Miss Rate: {Math.round(state.cacheStats.missRate * 100)}%
          </ThemedText>
        </View>
      )}

      {/* Sources List */}
      {state.sources.length > 0 && (
        <View style={{ backgroundColor: '#1a1a1a', padding: 15, borderRadius: 10, marginTop: 20 }}>
          <ThemedText style={{ fontSize: 16, color: '#4a9eff', marginBottom: 10 }}>Cached Sources</ThemedText>
          {state.sources.map((source, index) => (
            <View key={source.id} style={{ marginBottom: 8, paddingLeft: 10 }}>
              <ThemedText style={{ fontSize: 14, color: '#fff' }}>{source.name}</ThemedText>
              <ThemedText style={{ fontSize: 12, color: '#aaa' }}>
                Type: {source.type} | Encrypted: {source.encrypted ? 'Yes' : 'No'}
              </ThemedText>
            </View>
          ))}
        </View>
      )}

      {/* Security Features */}
      <View style={{ backgroundColor: '#1a1a1a', padding: 15, borderRadius: 10, marginTop: 20 }}>
        <ThemedText style={{ fontSize: 16, color: '#4a9eff', marginBottom: 10 }}>Security Features</ThemedText>
        <ThemedText style={{ fontSize: 12, color: '#aaa', marginBottom: 3 }}>
          ✅ Secure random number generation with entropy validation
        </ThemedText>
        <ThemedText style={{ fontSize: 12, color: '#aaa', marginBottom: 3 }}>
          ✅ Encrypted storage with device-specific keys
        </ThemedText>
        <ThemedText style={{ fontSize: 12, color: '#aaa', marginBottom: 3 }}>
          ✅ Sanitized error messages for user safety
        </ThemedText>
        <ThemedText style={{ fontSize: 12, color: '#aaa', marginBottom: 3 }}>
          ✅ Race condition prevention and memory leak protection
        </ThemedText>
        <ThemedText style={{ fontSize: 12, color: '#aaa', marginBottom: 3 }}>
          ✅ Input validation with TypeScript strict types
        </ThemedText>
        <ThemedText style={{ fontSize: 12, color: '#aaa', marginBottom: 3 }}>
          ✅ Performance optimizations and debounced operations
        </ThemedText>
        <ThemedText style={{ fontSize: 12, color: '#aaa' }}>
          ✅ Encore API integration with proper authentication
        </ThemedText>
      </View>
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {!state.showPassphraseInput ? (
        renderMainView()
      ) : (
        <PassphraseInputOptimized
          title="Security Demo - Passphrase Test"
          subtitle="Enter any passphrase (use '000000' to test error handling)"
          accountName="demo-account"
          onSubmit={handlePassphraseSubmit}
          onCancel={handlePassphraseCancel}
          isVisible={state.showPassphraseInput}
        />
      )}
    </View>
  );
}