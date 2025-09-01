import React from 'react';
import { View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cssInterop } from 'nativewind';

import { PassphraseDemo } from '@/components/PassphraseDemo';

// Apply cssInterop for SafeAreaView
const StyledSafeAreaView = cssInterop(SafeAreaView, {
  className: 'style',
});

const PassphraseScreen = () => {
  const safeAreaClassName = `flex-1 ${
    Platform.OS === 'ios' && Platform.isTV ? 'mt-[5vh]' : ''
  }`;

  return (
    <StyledSafeAreaView className={safeAreaClassName}>
      <View className="flex-1 bg-black">
        <PassphraseDemo />
      </View>
    </StyledSafeAreaView>
  );
};

export default PassphraseScreen;