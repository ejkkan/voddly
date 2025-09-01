import React, { useState } from 'react';
import { View, Alert, Platform } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedButton } from './ThemedButton';
import { PassphraseInput } from './PassphraseInput';

export function PassphraseDemo() {
  const [showPassphraseInput, setShowPassphraseInput] = useState(false);
  const [lastResult, setLastResult] = useState<string>('');

  const handleShowInput = () => {
    setShowPassphraseInput(true);
  };

  const handlePassphraseSubmit = async (
    passphrase: string,
    onProgress?: (progress: number, message?: string) => void
  ) => {
    // Simulate passphrase validation process
    onProgress?.(0, 'Starting validation...');
    
    // Simulate different phases of validation
    await new Promise(resolve => setTimeout(resolve, 500));
    onProgress?.(0.2, 'Checking device registration...');
    
    await new Promise(resolve => setTimeout(resolve, 800));
    onProgress?.(0.4, 'Deriving encryption key...');
    
    // Simulate key derivation with iterations
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      onProgress?.(0.4 + (i * 0.05), `Key derivation... ${Math.round((0.4 + (i * 0.05)) * 100)}%`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    onProgress?.(0.95, 'Validating passphrase...');
    
    await new Promise(resolve => setTimeout(resolve, 200));
    onProgress?.(1.0, 'Validation complete!');

    // Simulate validation result
    if (passphrase === '123456') {
      setLastResult(`✅ Success! Passphrase "${passphrase}" validated successfully.`);
      setShowPassphraseInput(false);
    } else if (passphrase === '000000') {
      throw new Error('Invalid passphrase. Please try again.');
    } else {
      setLastResult(`✅ Demo Success! Passphrase "${passphrase}" accepted (demo mode).`);
      setShowPassphraseInput(false);
    }
  };

  const handleCancel = () => {
    setShowPassphraseInput(false);
    setLastResult('❌ Passphrase validation cancelled.');
  };

  return (
    <View style={{ flex: 1 }}>
      {!showPassphraseInput ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <ThemedText
            style={{
              fontSize: 32,
              fontWeight: 'bold',
              color: '#fff',
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            Passphrase Demo
          </ThemedText>
          
          <ThemedText
            style={{
              fontSize: 18,
              color: '#aaa',
              textAlign: 'center',
              marginBottom: 30,
              lineHeight: 26,
            }}
          >
            Test the passphrase validation system with progress tracking,
            success/fail states, and tvOS-optimized UI.
          </ThemedText>

          <ThemedButton
            onPress={handleShowInput}
            style={{
              backgroundColor: '#4a9eff',
              paddingHorizontal: 40,
              paddingVertical: 20,
              borderRadius: 12,
              marginBottom: 30,
              // tvOS focus styling
              ...(Platform.isTV && {
                shadowColor: '#4a9eff',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 8,
              }),
            }}
            textStyle={{
              color: '#fff',
              fontSize: 22,
              fontWeight: '600',
            }}
          >
            Test Passphrase Input
          </ThemedButton>

          {lastResult && (
            <View
              style={{
                backgroundColor: '#2a2a2a',
                padding: 20,
                borderRadius: 12,
                maxWidth: '90%',
              }}
            >
              <ThemedText
                style={{
                  color: '#fff',
                  fontSize: 16,
                  textAlign: 'center',
                  lineHeight: 22,
                }}
              >
                {lastResult}
              </ThemedText>
            </View>
          )}

          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <ThemedText
              style={{
                color: '#666',
                fontSize: 14,
                textAlign: 'center',
                marginBottom: 10,
              }}
            >
              Demo Instructions:
            </ThemedText>
            <ThemedText
              style={{
                color: '#888',
                fontSize: 12,
                textAlign: 'center',
                lineHeight: 18,
              }}
            >
              • Enter "123456" for success demo{'\n'}
              • Enter "000000" for failure demo{'\n'}
              • Any other passphrase will show demo success
            </ThemedText>
          </View>
        </View>
      ) : (
        <PassphraseInput
          title="Demo Passphrase Validation"
          subtitle="Enter a passphrase to test the validation system"
          accountName="demo-account"
          onSubmit={handlePassphraseSubmit}
          onCancel={handleCancel}
          isVisible={showPassphraseInput}
        />
      )}
    </View>
  );
}