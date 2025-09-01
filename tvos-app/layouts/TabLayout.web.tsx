import {
  Tabs,
  TabSlot,
  TabList,
  TabTrigger,
  TabTriggerSlotProps,
} from 'expo-router/ui';
import React from 'react';
import { View } from 'react-native';

import '@/global.css';
import { ThemedButton, ThemedButtonBehavior } from '@/components/ThemedButton';

function CustomTabButton(props: TabTriggerSlotProps & { children: string }) {
  return (
    <View className="flex-1 justify-center items-center">
      <ThemedButton
        focusHoverBehavior={ThemedButtonBehavior.scaleOnFocusHover}
        textClassName={
          props.isFocused
            ? '!text-[4vh] !text-[--color-tab-bar-selected]'
            : '!text-[4vh] !text-[--color-tab-bar-default]'
        }
        {...props}
      >
        {props.children}
      </ThemedButton>
    </View>
  );
}
CustomTabButton.displayName = 'CustomTabButton';

/**
 * The tab bar for the app used in web and Android TV.
 * This is implemented using the Expo Router custom tab layout (https://docs.expo.dev/router/advanced/custom-tabs/)
 */
export default function TabLayout() {
  return (
    <Tabs className="bg-[--color-background]">
      <TabList className="flex flex-row justify-center items-center width-full bg-[--color-tab-bar-background] h-[10vh] ">
        <TabTrigger name="index" href="/" asChild>
          <CustomTabButton>Home</CustomTabButton>
        </TabTrigger>
        <TabTrigger name="tvdemo" href="/(tabs)/tvdemo" asChild>
          <CustomTabButton>Focus/hover/active styles</CustomTabButton>
        </TabTrigger>
        <TabTrigger name="video" href="/(tabs)/video" asChild>
          <CustomTabButton>Video</CustomTabButton>
        </TabTrigger>
        <TabTrigger name="video-rn" href="/(tabs)/video-rn" asChild>
          <CustomTabButton>RN Video</CustomTabButton>
        </TabTrigger>
        <TabTrigger name="passphrase" href="/(tabs)/passphrase" asChild>
          <CustomTabButton>Passphrase</CustomTabButton>
        </TabTrigger>
      </TabList>
      <TabSlot />
    </Tabs>
  );
}
