import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Button, ControlledInput, Text, View } from '@/components/ui';

const schema = z.object({
  name: z
    .string({
      required_error: 'Name is required',
    })
    .min(2, 'Name must be at least 2 characters'),
  email: z
    .string({
      required_error: 'Email is required',
    })
    .email('Invalid email format'),
  password: z
    .string({
      required_error: 'Password is required',
    })
    .min(6, 'Password must be at least 6 characters'),
});

export type FormType = z.infer<typeof schema>;

export type SignupFormProps = {
  onSubmit?: SubmitHandler<FormType>;
};

export const SignupForm = ({ onSubmit = () => {} }: SignupFormProps) => {
  const { handleSubmit, control } = useForm<FormType>({
    resolver: zodResolver(schema),
  });
  return (
    <View className="w-full p-4">
      <View className="items-center justify-center pb-4">
        <Text
          testID="form-title"
          className="pb-2 text-center text-3xl font-bold"
        >
          Create account
        </Text>

        <Text className="mb-6 text-center text-gray-500">
          Use any name, email and password to try the demo.
        </Text>
      </View>

      <ControlledInput
        testID="name"
        control={control}
        name="name"
        label="Name"
      />

      <ControlledInput
        testID="email-input"
        control={control}
        name="email"
        label="Email"
      />
      <ControlledInput
        testID="password-input"
        control={control}
        name="password"
        label="Password"
        placeholder="***"
        secureTextEntry={true}
      />
      <Button
        testID="signup-button"
        label="Create account"
        onPress={handleSubmit(onSubmit)}
      />
    </View>
  );
};
