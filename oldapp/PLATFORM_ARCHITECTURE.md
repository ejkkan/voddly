# Platform-Specific Architecture

## Overview

The app now has a complete platform-specific architecture that provides different UIs and experiences for Mobile, tvOS, and Web platforms while maintaining code reusability and clear separation of concerns.

## Key Features

### 1. Platform Detection & Selection

- **Location**: `src/lib/platform.ts`
- **Utilities**: `isTV`, `isMobile`, `isWeb`, `isIOS`, `isAndroid`
- **Selector**: `platformSelector()` - Chooses appropriate implementation based on platform

### 2. Platform Capabilities

- **Location**: `src/lib/platform-capabilities.ts`
- Defines what each platform supports (libraries, features, input methods)
- Prevents cross-platform incompatibilities

### 3. Platform Guards

- **Location**: `src/lib/platform-guards.ts`
- Runtime checks to ensure platform-specific code runs only where appropriate
- HOCs for wrapping platform-specific components

## File Structure

### Authentication (`src/app/(auth)/`)

```
login/
  index.tsx           # Platform selector
  login.mobile.tsx    # Mobile touch-optimized
  login.tvos.tsx      # TV remote-friendly
  login.web.tsx       # Desktop layout

signup/
  index.tsx           # Platform selector
  signup.mobile.tsx   # Mobile signup
  signup.tvos.tsx     # TV signup
  signup.web.tsx      # Desktop signup
```

### Onboarding (`src/app/onboarding/`)

```
index.tsx               # Platform selector
onboarding.mobile.tsx   # Swipeable mobile onboarding
onboarding.tvos.tsx     # TV-optimized with auto-rotation
onboarding.web.tsx      # Desktop step-by-step
```

### Main App Layout (`src/app/(app)/`)

```
_layout.tsx             # Platform selector
_layout.mobile.tsx      # Bottom tabs + top tabs for content
_layout.tvos.tsx        # Netflix-style animated sidebar
_layout.web.tsx         # Fixed sidebar dashboard
```

## Platform-Specific Features

### Mobile

- Bottom tab navigation (Home, Style, Settings)
- Top tabs within Home (Playlists, Movies, Series, Live)
- Touch-optimized interfaces
- Swipeable onboarding
- Mobile-friendly forms

### tvOS

- Netflix-style sidebar (hidden by default)
- Remote control navigation
- Large focus areas for easy selection
- Auto-rotating content in onboarding
- TV-optimized text sizes

### Web

- Fixed sidebar navigation
- Dashboard-style layout
- Keyboard navigation support
- Desktop-optimized forms
- Multi-column layouts

## Content Screens

Located in `src/components/content/`:

- `PlaylistsScreen.tsx` - Display user playlists
- `MoviesScreen.tsx` - Movies grid
- `SeriesScreen.tsx` - TV series grid
- `LiveScreen.tsx` - Live channels list

## Detail Screens

- `movies/[id].tsx` - Movie details with player launch
- `series/[id].tsx` - Series details with episode selection
- `live/[id].tsx` - Live channel details
- `player.tsx` - Platform-aware video player

## Usage Examples

### Creating Platform-Specific Components

```tsx
// Import platform utilities
import { platformSelector } from '@/lib/platform';

// Create platform-specific implementations
const ComponentMobile = () => <View>Mobile UI</View>;
const ComponentTVOS = () => <View>TV UI</View>;
const ComponentWeb = () => <View>Web UI</View>;

// Use platform selector
const Component = platformSelector({
  mobile: ComponentMobile,
  tv: ComponentTVOS,
  web: ComponentWeb,
});
```

### Using Platform Guards

```tsx
import { requirePlatform } from '@/lib/platform-guards';

// In a mobile-only file
requirePlatform('mobile');
import { GestureHandler } from 'react-native-gesture-handler'; // Safe!
```

### Conditional Platform Rendering

```tsx
import { PlatformSelect } from '@/lib/platform-select';

<PlatformSelect
  mobile={<MobileComponent />}
  tv={<TVComponent />}
  web={<WebComponent />}
  fallback={<DefaultComponent />}
/>;
```

## Navigation Flow

1. **First Time Users**: Onboarding → Login → Main App
2. **Returning Users**: Login → Main App
3. **Content Navigation**:
   - Browse content (Playlists/Movies/Series/Live)
   - Select item → Detail Screen
   - Play → Video Player

## Styling Considerations

- Use platform-aware sizing:
  - tvOS: Larger text and touch targets
  - Mobile: Standard mobile sizing
  - Web: Desktop-appropriate sizing
- Respect platform conventions:
  - iOS/Android: Native navigation patterns
  - tvOS: Focus-based navigation
  - Web: Mouse/keyboard navigation

## Adding New Features

1. **Create platform files**: `feature.mobile.tsx`, `feature.tvos.tsx`, `feature.web.tsx`
2. **Create selector**: `feature/index.tsx` with platform selector
3. **Add platform checks**: Use guards for platform-specific libraries
4. **Test on each platform**: Ensure compatibility

## Important Notes

- Always use platform guards when importing platform-specific libraries
- Test thoroughly on each target platform
- Keep business logic separate from UI when possible
- Use the capability matrix to check library compatibility
- Follow platform-specific UX guidelines
