# Passphrase System for tvOS

This implementation adds a complete passphrase validation system to the tvOS app with the following features:

## Features

### ✅ Passphrase Input Component
- **tvOS-optimized UI**: Large text, proper focus handling, and TV-friendly styling
- **Real-time validation**: Shows errors immediately with shake animations
- **Progress tracking**: Visual progress bar with elapsed time and iteration count
- **Success/Fail states**: Animated success checkmark and error handling
- **Auto-focus**: Automatically focuses input when modal appears

### ✅ Crypto Implementation
- **JavaScript-only crypto**: Uses `@noble/ciphers` and `@noble/hashes` for tvOS compatibility
- **Optimized iterations**: 100,000 PBKDF2 iterations for tvOS (vs 500k for iOS)
- **Progress callbacks**: Chunked key derivation with real-time progress updates
- **AES-GCM decryption**: Secure decryption of encrypted master keys

### ✅ Device Management
- **Device registration**: Automatic device registration with the backend
- **Key caching**: Local storage of device-specific encryption keys
- **Session management**: Temporary passphrase caching for user convenience
- **Device validation**: Checks device registration status before prompting

### ✅ API Integration
- **Backend communication**: Full integration with Voddly backend APIs
- **Error handling**: Comprehensive error handling with user-friendly messages
- **Device-specific keys**: Uses tvOS-optimized encryption parameters
- **Automatic retry**: Handles network errors and retries gracefully

## Files Structure

```
tvos-app/
├── components/
│   ├── PassphraseInput.tsx      # Main passphrase input component
│   └── PassphraseDemo.tsx       # Demo component for testing
├── lib/
│   ├── crypto-utils.ts          # Crypto operations for tvOS
│   ├── api-client.ts            # Backend API client
│   ├── device-id.ts             # Device ID management
│   └── passphrase-manager.ts    # Main passphrase logic
├── app/(tabs)/
│   └── passphrase.tsx           # Passphrase screen
└── PASSPHRASE_README.md         # This documentation
```

## Usage

### Basic Usage

```tsx
import { PassphraseInput } from '@/components/PassphraseInput';

function MyScreen() {
  const handleSubmit = async (passphrase: string, onProgress) => {
    // Your validation logic here
    onProgress(0.5, 'Validating...');
    // ... validation code ...
    onProgress(1.0, 'Complete!');
  };

  return (
    <PassphraseInput
      title="Enter Passphrase"
      subtitle="Please enter your 6-digit passphrase"
      onSubmit={handleSubmit}
      onCancel={() => console.log('Cancelled')}
      isVisible={true}
    />
  );
}
```

### Using PassphraseManager

```tsx
import { passphraseManager } from '@/lib/passphrase-manager';

// Validate passphrase with progress
const result = await passphraseManager.validatePassphraseWithProgress(
  'account-id',
  '123456',
  (progress, message) => {
    console.log(`${Math.round(progress * 100)}%: ${message}`);
  }
);

if (result.success) {
  console.log('Passphrase validated!');
}
```

## Demo Instructions

1. Navigate to the "Passphrase" tab in the tvOS app
2. Click "Test Passphrase Input" to open the passphrase modal
3. Test different scenarios:
   - Enter `123456` for success demo
   - Enter `000000` for failure demo  
   - Any other passphrase shows demo success
4. Observe the progress tracking, animations, and state changes

## Technical Details

### Crypto Implementation

- **Key Derivation**: PBKDF2-SHA256 with 100,000 iterations for tvOS
- **Encryption**: AES-256-GCM for master key encryption
- **Progress Tracking**: Chunked processing to show real-time progress
- **Fallbacks**: Web Crypto API with noble.js fallback

### Device Registration Flow

1. Check if device is already registered
2. If not registered, attempt device registration with passphrase
3. Store device-specific encryption keys locally
4. Validate passphrase using device keys
5. Cache passphrase temporarily for session

### Performance Optimizations

- **Reduced iterations**: 100k vs 500k for better tvOS performance
- **Chunked processing**: Prevents UI blocking during key derivation
- **Local caching**: Avoids repeated API calls
- **Progress feedback**: Keeps users informed during long operations

## Security Features

- **No passphrase storage**: Passphrase is never permanently stored
- **Device-specific keys**: Each device has unique encryption keys
- **Session-only caching**: Temporary caching cleared on app restart
- **Bank-level encryption**: AES-256-GCM with proper key derivation

## Dependencies

```json
{
  "@noble/ciphers": "^2.0.0",
  "@noble/hashes": "^2.0.0",
  "@react-native-async-storage/async-storage": "^2.2.0"
}
```

## Integration with Backend

The system integrates with these backend endpoints:

- `POST /user/check-device` - Check device registration status
- `POST /user/register-device` - Register new device with passphrase
- `POST /user/get-device-key` - Get device-specific encryption keys
- `POST /account/setup-passphrase` - Initial passphrase setup

## Future Enhancements

- [ ] Biometric authentication integration
- [ ] Hardware security module support
- [ ] Multi-factor authentication
- [ ] Passphrase strength validation
- [ ] Auto-logout on inactivity
- [ ] Offline mode support

## Troubleshooting

### Common Issues

1. **Crypto libraries not loading**: Ensure `@noble/ciphers` and `@noble/hashes` are installed
2. **Progress not updating**: Check that progress callbacks are being called
3. **Focus issues**: Ensure `autoFocus` is working on TextInput
4. **Animation glitches**: Verify React Native Reanimated is properly configured

### Debug Logging

Enable debug logging by checking the console for `[PassphraseManager]`, `[API]`, and `[Crypto]` prefixed messages.