/* eslint-disable simple-import-sort/imports */
import { Link, usePathname } from 'expo-router';
import React from 'react';
import { useWindowDimensions } from 'react-native';
import { Pressable, SafeAreaView, Text, View } from '@/components/ui';

type AppHref =
  | '/(app)/dashboard'
  | '/(app)/search'
  | '/(app)/vods'
  | '/(app)/series'
  | '/(app)/live'
  | '/(app)/playlists'
  | '/(app)/settings';

type NavItem = {
  label: string;
  href: AppHref;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/(app)/dashboard' },
  { label: 'Search', href: '/(app)/search' },
  { label: 'Series', href: '/(app)/series' },
  { label: 'VODs', href: '/(app)/vods' },
  { label: 'Live', href: '/(app)/live' },
  { label: 'Playlists', href: '/(app)/playlists' },
  { label: 'Settings', href: '/(app)/settings' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isLarge = width >= 900; // iPad / laptop / TV-ish

  if (isLarge) {
    return (
      <SafeAreaView className="flex-1">
        <View className="h-full flex-row bg-white dark:bg-neutral-950">
          <Sidebar />
          <View className="flex-1">{children}</View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 bg-white dark:bg-neutral-950">
        <TopBar />
        <View className="flex-1">{children}</View>
      </View>
    </SafeAreaView>
  );
}

function Sidebar() {
  const pathname = usePathname();
  return (
    <View className="w-72 gap-2 border-r border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950">
      <Text className="mb-4 text-xl font-bold text-neutral-900 dark:text-neutral-50">
        IPTV
      </Text>
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} asChild>
            <Pressable
              className={
                'rounded-md px-3 py-2 ' +
                (active ? 'bg-neutral-100 dark:bg-white/10' : 'bg-transparent')
              }
            >
              <Text
                className={
                  'font-medium ' +
                  (active
                    ? 'text-neutral-900 dark:text-white'
                    : 'text-neutral-700 dark:text-neutral-200')
                }
              >
                {item.label}
              </Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

function TopBar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const activeItem = React.useMemo(
    () => NAV_ITEMS.find((item) => pathname.startsWith(item.href)),
    [pathname]
  );
  return (
    <View className="border-b border-neutral-200 bg-white dark:border-white/10 dark:bg-neutral-950">
      <View className="flex-row items-center justify-between px-3 py-2">
        <Pressable onPress={() => setOpen((v) => !v)} className="px-3 py-2">
          <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
            Menu
          </Text>
        </Pressable>
        <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          {activeItem?.label ?? 'IPTV'}
        </Text>
        <View className="w-[64px]" />
      </View>
      {open && (
        <View className="mt-0 gap-2 p-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} asChild>
                <Pressable
                  onPress={() => setOpen(false)}
                  className={
                    'rounded-md px-3 py-2 ' +
                    (active
                      ? 'bg-neutral-100 dark:bg-white/10'
                      : 'bg-transparent')
                  }
                >
                  <Text
                    className={
                      'font-medium ' +
                      (active
                        ? 'text-neutral-900 dark:text-white'
                        : 'text-neutral-700 dark:text-neutral-200')
                    }
                  >
                    {item.label}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </View>
      )}
    </View>
  );
}
