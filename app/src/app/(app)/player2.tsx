import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View, Text } from 'react-native';

export default function Player2() {
  const { video } = useLocalSearchParams();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: 'white', textAlign: 'center' }}>
        Player2 is only available on web platform.{'\n'}
        Video URL: {video}
      </Text>
    </View>
  );
}
