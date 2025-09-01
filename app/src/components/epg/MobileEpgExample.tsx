import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MobileEpg } from './MobileEpg';

interface MobileEpgExampleProps {
  sourceId: string;
  channelId: string;
  channelTitle?: string;
  channelLogo?: string;
}

/**
 * Example usage of MobileEpg component
 * 
 * Usage:
 * ```tsx
 * <MobileEpgExample 
 *   sourceId="your-source-id"
 *   channelId="your-channel-id"
 *   channelTitle="Channel Name"
 *   channelLogo="https://example.com/logo.png"
 * />
 * ```
 */
export function MobileEpgExample({ 
  sourceId, 
  channelId, 
  channelTitle, 
  channelLogo 
}: MobileEpgExampleProps) {
  return (
    <View style={styles.container}>
      <MobileEpg
        sourceId={sourceId}
        channelId={channelId}
        channelTitle={channelTitle}
        channelLogo={channelLogo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});