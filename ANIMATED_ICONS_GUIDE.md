# Animated Icons Integration Guide

This guide covers the integration of both [react-useanimations](https://github.com/useAnimations/react-useanimations) and [Lordicon](https://lordicon.com/) into the Voddly project, providing beautiful animated icons with hover effects throughout the navigation system.

## 🎯 Overview

We've successfully integrated:
- **67 animated icons** from react-useanimations, organized into categories
- **Lordicon integration** for premium animated icons (starting with notification icon)
- **Unified HybridIcon system** that seamlessly combines both icon libraries
- **Hover animations** and active states throughout the navigation system

## 📦 Available Icons

### Navigation & UI (8 icons)

- `activity` - Activity/pulse animation
- `home` - Home icon with door animation
- `explore` - Compass/explore animation
- `menu`, `menu2`, `menu3`, `menu4` - Various hamburger menu animations
- `settings`, `settings2` - Gear/settings animations
- `help` - Question mark help animation
- `info` - Information icon animation

### Media & Entertainment (12 icons)

- `airplay` - AirPlay/casting animation
- `video`, `video2` - Video play animations
- `playPause`, `playPauseCircle` - Play/pause toggle animations
- `skipBack`, `skipForward` - Media control animations
- `volume` - Volume/speaker animation
- `youtube`, `youtube2` - YouTube brand animations
- `microphone`, `microphone2` - Microphone animations

### User & Social (8 icons)

- `heart` - Heart/favorite animation
- `bookmark` - Bookmark save animation
- `star` - Star rating animation
- `thumbUp` - Thumbs up/like animation
- `share` - Share/export animation
- `notification`, `notification2` - Bell notification animations
- `userPlus`, `userMinus`, `userX` - User management animations

### Actions & Controls (8 icons)

- `edit` - Pencil edit animation
- `copy` - Copy/duplicate animation
- `download` - Download arrow animation
- `trash`, `trash2` - Delete/trash animations
- `archive` - Archive/box animation
- `folder` - Folder open/close animation
- `lock` - Lock/unlock animation
- `toggle` - Toggle switch animation
- `checkBox`, `checkmark` - Checkbox and checkmark animations
- `radioButton` - Radio button selection animation

### Arrows & Navigation (7 icons)

- `arrowUp`, `arrowDown` - Directional arrows
- `arrowUpCircle`, `arrowDownCircle` - Circular directional arrows
- `arrowLeftCircle`, `arrowRightCircle` - Horizontal circular arrows
- `scrollDown` - Scroll indicator animation

### Search & Zoom (5 icons)

- `searchToX` - Search to X close animation
- `zoomIn`, `zoomOut` - Zoom controls
- `visibility`, `visibility2` - Eye/visibility toggle animations

### Alerts & Status (7 icons)

- `alertCircle`, `alertOctagon`, `alertTriangle` - Various alert styles
- `error` - Error/X animation
- `loading`, `loading2`, `loading3` - Loading spinner animations
- `infinity` - Infinity loop animation

### Utilities (5 icons)

- `calendar` - Calendar/date animation
- `mail` - Email/envelope animation
- `maximizeMinimize`, `maximizeMinimize2` - Window control animations
- `plusToX` - Plus to X transformation

### Social Media (8 icons)

- `facebook`, `instagram`, `twitter`, `linkedin` - Social platform animations
- `github`, `behance`, `dribbble`, `codepen` - Developer platform animations
- `pocket` - Pocket save animation

### Lordicon Icons (Premium)

- `notification` - Beautiful account/notification animation with bell ringing and bouncing effects

## 🚀 Usage

### Unified HybridIcon System (Recommended)

```tsx
import { HybridIcon } from '@/components/ui';

// Works with both react-useanimations and Lordicon icons
<HybridIcon name="heart" size={24} />
<HybridIcon name="notification" size={24} /> // Lordicon

// With hover animation
<HybridIcon
  name="heart"
  size={24}
  animateOnHover
  strokeColor="#fff"
/>

// Active state (always animated)
<HybridIcon
  name="notification"
  size={24}
  active={true}
  strokeColor="#ff0000"
/>
```

### Individual Icon Systems

```tsx
import { AnimatedIcon, LordIcon } from '@/components/ui';
import notificationIcon from '@/assets/icons/notification.json';

// React-useanimations icon
<AnimatedIcon name="heart" size={24} animateOnHover />

// Lordicon icon
<LordIcon 
  icon={notificationIcon}
  size={24} 
  animateOnHover 
  colors={{ primary: '#fff' }}
/>
```

### Advanced Configuration

```tsx
<AnimatedIcon
  name="loading2"
  size={32}
  strokeColor="#3b82f6"
  fillColor="#1e40af"
  autoplay={true}
  loop={true}
  speed={1.5}
  animateOnHover={false}
  onPress={() => console.log('Icon clicked!')}
/>
```

### Predefined Components

```tsx
import { AnimatedIcons } from '@/components/ui';

// Use predefined components for common icons
<AnimatedIcons.Home size={24} animateOnHover />
<AnimatedIcons.Heart size={24} active={isLiked} />
<AnimatedIcons.Loading size={24} /> // Auto-loops
```

## 🎨 Integration Points

### Sidebar Navigation

- **Home**: `home` icon with hover animation (react-useanimations)
- **Favorites**: `heart` icon that animates on hover and when active (react-useanimations)
- **Playlists**: `bookmark` icon with save animation (react-useanimations)
- **Sources**: `folder` icon with open/close animation (react-useanimations)
- **Notifications**: `notification` icon with beautiful bell animation (**Lordicon**)
- **Profile**: `userPlus` icon with user animation (react-useanimations)
- **Settings**: `settings` icon with gear rotation (react-useanimations)

### Top Navigation

- **Dashboard**: `home` icon
- **Movies**: `video` icon with play animation
- **Series**: `video2` icon with alternative play animation
- **TV**: `airplay` icon with casting animation
- **Search**: `searchToX` icon that transforms on interaction

## 🛠️ Component API

### AnimatedIcon Props

| Prop             | Type               | Default     | Description                                 |
| ---------------- | ------------------ | ----------- | ------------------------------------------- |
| `name`           | `AnimatedIconName` | -           | **Required.** The name of the animated icon |
| `size`           | `number`           | `24`        | Size of the icon in pixels                  |
| `strokeColor`    | `string`           | `'inherit'` | Stroke color of the icon                    |
| `fillColor`      | `string`           | `''`        | Fill color of the icon                      |
| `animateOnHover` | `boolean`          | `false`     | Whether to animate on hover/press           |
| `reverse`        | `boolean`          | `false`     | Whether to reverse the animation            |
| `autoplay`       | `boolean`          | `false`     | Whether to autoplay the animation           |
| `loop`           | `boolean`          | `false`     | Whether to loop the animation               |
| `speed`          | `number`           | `1`         | Animation speed multiplier                  |
| `active`         | `boolean`          | `false`     | Whether the icon is in active state         |
| `onPress`        | `() => void`       | -           | Callback when icon is pressed               |
| `style`          | `ViewStyle`        | -           | Additional styles for wrapper               |

## 📱 Platform Support

- ✅ **React Native**: Full support with native animations
- ✅ **Web**: Full support with CSS animations and hover effects
- ✅ **iOS**: Optimized for iOS with proper touch handling
- ✅ **Android**: Optimized for Android with material design feel

## 🎯 Best Practices

### Performance

- Icons are lazy-loaded - only imported icons are included in bundle
- Use `animateOnHover` sparingly for better performance
- Prefer `active` state over continuous `autoplay` when possible

### Accessibility

- Icons inherit accessibility properties from parent components
- Use semantic colors that work with system themes
- Provide proper labels for screen readers

### Design Consistency

- Use consistent sizing across similar UI elements
- Stick to the predefined color palette
- Use hover animations to provide visual feedback

## 🔧 Customization

### Adding New Icons

1. Import the icon in `/src/lib/animated-icons.ts`
2. Add it to the `ANIMATED_ICONS` object
3. Categorize it in `ICON_CATEGORIES` if needed
4. Update the UI mapping in `UI_ICON_MAPPING`

### Custom Animation Behavior

```tsx
<AnimatedIcon
  name="heart"
  options={{
    // Custom lottie options
    renderer: 'svg',
    loop: false,
    autoplay: false,
  }}
  pathCss="stroke-dasharray: 10,5;"
/>
```

## 🐛 Troubleshooting

### Common Issues

1. **Icon not animating**: Check if `animateOnHover` or `active` is set
2. **Bundle size concerns**: Only import icons you actually use
3. **Performance issues**: Reduce number of simultaneously animating icons
4. **Color not applying**: Ensure the icon supports the color property you're using

### Debug Mode

```tsx
// Enable debug logging
<AnimatedIcon name="heart" options={{ debug: true }} />
```

## 📚 Resources

- [react-useanimations GitHub](https://github.com/useAnimations/react-useanimations)
- [Interactive Demo](https://react.useanimations.com)
- [Lottie Documentation](https://airbnb.design/lottie/)

## 🎉 Demo Component

Use the `AnimatedIconsDemo` component to explore all available icons:

```tsx
import { AnimatedIconsDemo } from '@/components/AnimatedIconsDemo';

// In your app
<AnimatedIconsDemo />;
```

This provides an interactive showcase of all 67 icons with different animation states and configuration options.
