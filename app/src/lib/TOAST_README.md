# Unified Toast System

This project now uses `@backpackapp-io/react-native-toast` as a unified toast solution for both React Native and web platforms

## Features

- **Unified API**: Same toast system works on both native and web
- **Action Support**: Toasts can include action buttons (e.g., "Dismiss", "Retry")
- **Multiple Variants**: Success, error, info, and warning toasts
- **Customizable**: Duration, position, and styling options
- **Promise Support**: Built-in promise toast handling
- **Loading States**: Show and dismiss loading toasts programmatically

## Basic Usage

### Simple Toasts

```typescript
import { notify } from '@/lib/toast';

// Success toast
notify.success('Operation completed successfully!');

// Error toast
notify.error('Something went wrong!');

// Info toast
notify.info('Here is some information');

// Warning toast
notify.warning('Please be careful');
```

### Toast with Actions

```typescript
// Toast with dismiss button
notify.success('Action completed!', {
  action: {
    label: 'Dismiss',
    onPress: () => console.log('Toast dismissed'),
  },
});

// Toast with custom action
notify.info('New message received', {
  action: {
    label: 'View',
    onPress: () => navigateToMessage(),
  },
  duration: 6000, // Give more time for user interaction
});
```

### Custom Duration and Position

```typescript
import { ToastPosition } from '@/lib/toast';

// Short duration
notify.success('Quick message', { duration: 2000 });

// Custom position
notify.error('Bottom error', { position: ToastPosition.BOTTOM });
notify.info('Top info', { position: ToastPosition.TOP });
```

### Advanced Usage

```typescript
import { toast } from '@/lib/toast';

// Promise toast
const promise = someAsyncOperation();
toast.promise(promise, {
  loading: 'Loading...',
  success: (data) => `Success: ${data.message}`,
  error: (err) => `Error: ${err.message}`,
});

// Loading toast with manual control
const id = toast.loading('Processing...');
// ... do work ...
toast.dismiss(id);
notify.success('Done!');
```

### Toast with Description

```typescript
notify.info('Update available', {
  description: 'A new version is ready to install',
  duration: 5000,
});
```

## API Reference

### `notify` Object

- `notify.success(message, options?)` - Success toast
- `notify.error(message, options?)` - Error toast
- `notify.info(message, options?)` - Info toast
- `notify.warning(message, options?)` - Warning toast

### `toast` Function

Direct access to the underlying toast library for advanced use cases:

- `toast(message, options?)` - Basic toast
- `toast.success(message, options?)` - Success toast
- `toast.error(message, options?)` - Error toast
- `toast.promise(promise, messages, options?)` - Promise toast
- `toast.loading(message, options?)` - Loading toast
- `toast.dismiss(id)` - Dismiss specific toast

### Options

```typescript
type ToastOptions = {
  description?: string; // Additional text below title
  duration?: number; // How long to show (in ms)
  id?: string; // Unique identifier
  dismissible?: boolean; // Whether user can dismiss
  action?: {
    // Action button
    label: string;
    onPress: () => void;
  };
  position?: ToastPosition; // TOP, BOTTOM, or default
};
```

## Migration from Old System

The old `notify` API has been preserved, so existing code should work without changes. The main differences are:

1. **Unified**: No more platform-specific implementations
2. **Enhanced**: Better action support and positioning
3. **Modern**: Uses the latest toast library with better performance

## Examples

See `toast-examples.ts` for comprehensive usage examples and `components/ui/toast-demo.tsx` for a demo component.

## Setup

The toast system is automatically set up in the app layout with:

- `SafeAreaProvider` for proper positioning
- `GestureHandlerRootView` for gesture support
- `<Toasts />` component for rendering

No additional setup is required.
