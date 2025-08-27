import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from './button';
import { notify, toast, ToastPosition } from '@/lib/toast';

export function ToastDemo() {
  const showBasicToasts = () => {
    notify.success('Success toast!');
    setTimeout(() => notify.error('Error toast!'), 1000);
    setTimeout(() => notify.info('Info toast!'), 2000);
    setTimeout(() => notify.warning('Warning toast!'), 3000);
  };

  const showActionToasts = () => {
    notify.success('Action completed!', {
      action: {
        label: 'Undo',
        onPress: () => console.log('Undo pressed'),
      },
    });
  };

  const showPromiseToast = () => {
    const sleep = new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.5) {
          resolve({ username: 'User' });
        } else {
          reject('Operation failed');
        }
      }, 2500);
    });

    toast.promise(
      sleep,
      {
        loading: 'Loading...',
        success: (data: any) => `Welcome ${data.username}!`,
        error: (err: any) => err.toString(),
      },
      {
        position: ToastPosition.BOTTOM,
      }
    );
  };

  const showLoadingToast = () => {
    const id = toast.loading('Processing your request...');
    
    setTimeout(() => {
      toast.dismiss(id);
      notify.success('Request completed!');
    }, 3000);
  };

  const showPositionedToasts = () => {
    notify.success('Top position', { position: ToastPosition.TOP });
    setTimeout(() => notify.error('Bottom position', { position: ToastPosition.BOTTOM }), 1000);
  };

  const showCustomDuration = () => {
    notify.info('Short message', { duration: 2000 });
    setTimeout(() => notify.info('Long message', { duration: 8000 }), 1000);
  };

  return (
    <View style={styles.container}>
      <Button onPress={showBasicToasts} title="Show Basic Toasts" />
      <Button onPress={showActionToasts} title="Show Action Toast" />
      <Button onPress={showPromiseToast} title="Show Promise Toast" />
      <Button onPress={showLoadingToast} title="Show Loading Toast" />
      <Button onPress={showPositionedToasts} title="Show Positioned Toasts" />
      <Button onPress={showCustomDuration} title="Show Custom Duration" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 10,
  },
});
