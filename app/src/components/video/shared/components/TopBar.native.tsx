import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../themes/ThemeProvider';

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function TopBar({ title, showBack, onBack }: TopBarProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { gap: theme.dimensions.spacing }]}>
      {showBack && (
        <Pressable
          onPress={onBack}
          style={[
            styles.backButton,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.styles.buttonRadius,
            }
          ]}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
          <Text style={[
            styles.backText,
            {
              color: theme.colors.text,
              fontSize: theme.dimensions.fontSize.medium,
            }
          ]}>
            Back
          </Text>
        </Pressable>
      )}
      {title && (
        <Text 
          numberOfLines={1}
          style={[
            styles.title,
            {
              color: theme.colors.text,
              fontSize: theme.dimensions.fontSize.large,
            }
          ]}
        >
          {title}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  backText: {
    fontWeight: '500',
  },
  title: {
    flex: 1,
    fontWeight: '600',
  },
});