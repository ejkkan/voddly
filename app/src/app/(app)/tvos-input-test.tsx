import React, { useState } from 'react';

import { Button, FocusAwareStatusBar, Text, View } from '@/components/ui';
import { TVOSTextInput } from '@/components/ui/tvos-text-input';
import { isTV } from '@/lib/platform';

export default function TVOSInputTest() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isTV) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <FocusAwareStatusBar />
        <Text className="text-xl text-center">
          This page is designed for tvOS input testing.
          {'\n'}Please run this app on Apple TV to test input behavior.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center items-center p-8">
      <FocusAwareStatusBar />

      <Text className="text-3xl font-bold text-center mb-8">
        tvOS Input Test
      </Text>

      <Text className="text-xl text-center mb-4">
        Test text input behavior on tvOS
      </Text>

      <View className="space-y-6 w-full max-w-md">
        <View>
          <Text className="text-lg mb-2">Name:</Text>
          <TVOSTextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            className="border-2 border-gray-300 rounded-lg p-3 text-lg"
            testID="name-input"
          />
        </View>

        <View>
          <Text className="text-lg mb-2">Email:</Text>
          <TVOSTextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            className="border-2 border-gray-300 rounded-lg p-3 text-lg"
            testID="email-input"
          />
        </View>

        <View>
          <Text className="text-lg mb-2">Password:</Text>
          <TVOSTextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry={true}
            className="border-2 border-gray-300 rounded-lg p-3 text-lg"
            testID="password-input"
          />
        </View>

        <Button
          label="Submit"
          onPress={() => {
            alert(`Name: ${name}\nEmail: ${email}\nPassword: ${password}`);
          }}
          size="lg"
        />

        <Button
          label="Clear All"
          onPress={() => {
            setName('');
            setEmail('');
            setPassword('');
          }}
          variant="outline"
          size="lg"
        />
      </View>

      <Text className="text-center mt-8 text-gray-500">
        Tips for tvOS input:
        {'\n'}• Use D-pad to navigate between fields
        {'\n'}• Press Select to open keyboard
        {'\n'}• Type on keyboard, press Done when finished
        {'\n'}• Field should retain focus during typing
      </Text>
    </View>
  );
}
