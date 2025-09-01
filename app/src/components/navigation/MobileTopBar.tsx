import { Link, usePathname } from 'expo-router';
import React from 'react';
import { Platform, ScrollView } from 'react-native';

import { Pressable, Text, View } from '@/components/ui';

import { CONTENT_NAV_ITEMS } from './navigation-types';

export function MobileTopBar() {
  const pathname = usePathname();

  // Only show on Home tab
  const isHomeSection =
    pathname === '/(app)/dashboard' ||
    pathname === '/(app)/movies' ||
    pathname === '/(app)/series' ||
    pathname === '/(app)/tv' ||
    pathname === '/(app)';

  if (!isHomeSection) return null;

  return (
    <View
      className="absolute inset-x-0 top-0 z-40 border-b border-white/5 bg-black/60"
      style={{
        backdropFilter: Platform.OS === 'web' ? 'blur(30px)' : undefined,
        WebkitBackdropFilter: Platform.OS === 'web' ? 'blur(30px)' : undefined,
      }}
    >
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-4 py-3"
        >
          {CONTENT_NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === '/(app)/dashboard' && pathname === '/(app)');
            return (
              <Link key={item.href} href={item.href} asChild>
                <Pressable
                  className={
                    'mr-3 rounded-full px-4 py-2 ' +
                    (active ? 'bg-white/20' : 'bg-white/10')
                  }
                >
                  <Text
                    className={
                      'font-medium ' + (active ? 'text-white' : 'text-gray-400')
                    }
                  >
                    {item.label}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
