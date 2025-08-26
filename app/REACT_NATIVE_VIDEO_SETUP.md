# React Native Video v6 Setup Guide for Expo

This guide covers the installation and configuration of `react-native-video` v6 in an Expo managed workflow without ad support.

## Installation

### Step 1: Install the Package

```bash
# Using pnpm (recommended for this project)
pnpm add react-native-video

# Or using npm
npm install --save react-native-video

# Or using yarn
yarn add react-native-video
```

### Step 2: Configuration

The configuration has been set up in two parts:

#### 1. Expo Plugin Configuration (`plugins/with-react-native-video.js`)

A custom Expo plugin has been created to properly configure react-native-video for both iOS and Android platforms. This plugin:

- **iOS**: Enables video caching for better performance
- **Android**: Configures ExoPlayer with HLS, DASH, and SmoothStreaming support (no ad support)

#### 2. App Configuration (`app.config.ts`)

The plugin is registered in the app configuration with the following settings:

```typescript
plugins: [
  // ... other plugins
  [
    './plugins/with-react-native-video',
    {
      ios: {
        videoCaching: true, // Enable video caching for better performance
      },
      android: {
        useExoplayerSmoothStreaming: true,
        useExoplayerDash: true,
        useExoplayerHls: true,
        useExoplayerIMA: false, // No ad support
        useExoplayerRtsp: false,
      },
    },
  ],
  // ... other plugins
]
```

### Step 3: Prebuild (for development builds)

After configuration, run prebuild to apply the native changes:

```bash
# Clean prebuild (recommended for first setup)
pnpm run prebuild:staging --clean

# Or for production
pnpm run prebuild:production --clean
```

### Step 4: Platform-Specific Setup

#### iOS

The minimum iOS version required is **13.0** (already configured in `expo-build-properties`).

For local development:
```bash
cd ios
pod install
cd ..
pnpm run ios
```

#### Android

Requirements:
- Kotlin version >= 1.8.0 (already configured)
- compileSdkVersion: 34 (already configured)
- targetSdkVersion: 34 (already configured)

For local development:
```bash
pnpm run android
```

## Features Enabled

### iOS Features:
- ✅ Video Caching (improved performance)
- ✅ Background playback support
- ✅ Picture-in-Picture support
- ❌ Google IMA (ads) - Not included as requested

### Android Features:
- ✅ HLS Support
- ✅ DASH Support
- ✅ SmoothStreaming Support
- ❌ Google IMA (ads) - Disabled as requested
- ❌ RTSP Support - Disabled (can be enabled if needed)

## Usage Example

```typescript
import Video from 'react-native-video';
import { useRef } from 'react';

function VideoPlayer() {
  const videoRef = useRef(null);

  return (
    <Video
      ref={videoRef}
      source={{ uri: 'https://example.com/video.mp4' }}
      style={{ width: '100%', height: 200 }}
      controls={true}
      paused={false}
      resizeMode="contain"
      onError={(error) => console.error('Video error:', error)}
      onLoad={(data) => console.log('Video loaded:', data)}
    />
  );
}
```

## Common Props

- `source`: Video source (uri or require for local files)
- `controls`: Show native playback controls
- `paused`: Control playback state
- `volume`: Volume level (0.0 to 1.0)
- `rate`: Playback rate (0.0 to 2.0)
- `resizeMode`: 'contain', 'cover', 'stretch', or 'none'
- `repeat`: Loop the video
- `muted`: Mute audio
- `poster`: Thumbnail image URL

## Troubleshooting

### iOS Issues

1. **Pod installation fails**: 
   ```bash
   cd ios
   pod cache clean --all
   pod install --repo-update
   ```

2. **Video caching not working**:
   - Ensure `$RNVideoUseVideoCaching=true` is in your Podfile
   - Clean build: `rm -rf ios/build ios/Pods ios/Podfile.lock`

### Android Issues

1. **Build fails with Kotlin version error**:
   - Ensure `kotlinVersion = '1.8.0'` or higher in `android/build.gradle`

2. **ExoPlayer features not working**:
   - Check that the gradle properties are correctly set
   - Clean build: `cd android && ./gradlew clean`

### General Issues

1. **Video not playing**:
   - Check network permissions for HTTP/HTTPS content
   - Verify `usesCleartextTraffic: true` is set for HTTP content

2. **After configuration changes**:
   - Always run `pnpm run prebuild --clean`
   - For iOS: Run `pod install` in the ios directory
   - Clear metro cache: `pnpm start -c`

## Build Commands

### Development
```bash
# iOS
pnpm run build:development:ios

# Android
pnpm run build:development:android
```

### Staging
```bash
# iOS
pnpm run build:staging:ios

# Android
pnpm run build:staging:android
```

### Production
```bash
# iOS
pnpm run build:production:ios

# Android
pnpm run build:production:android
```

## Notes

- This setup does NOT include tvOS support
- Ad support (Google IMA) is intentionally disabled
- Video caching is enabled on iOS for better performance
- All major streaming protocols (HLS, DASH, SmoothStreaming) are enabled on Android
- The configuration uses a custom Expo plugin for proper native setup