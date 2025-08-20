import React, { useMemo, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Pressable,
} from '@/components/ui';
import { Input } from '@/components/ui/input';
import { useSession } from '@/lib/auth/hooks';
import { apiClient } from '@/lib/api-client';
import { passphraseCache } from '@/lib/passphrase-cache';
import { Env } from '@env';
import auth from '@/lib/auth/auth-client';
import { MobileCatalogStorage } from '@/lib/catalog-storage';
import { XtreamClient } from '@/lib/xtream-client';

export default function AddPlaylist() {
  const router = useRouter();
  const { data: session } = useSession();
  const [mode, setMode] = useState<'xtream' | 'm3u'>('xtream');
  const [accountName, setAccountName] = useState('My Account');
  const [sourceName, setSourceName] = useState('Living Room');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!session?.data?.user) {
    return <Redirect href="/signin" />;
  }

  const onSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (passphrase.length < 6)
        throw new Error('Passphrase must be at least 6 characters');

      if (mode === 'xtream') {
        if (!serverUrl || !username || !password)
          throw new Error('All fields are required');
        const res = await apiClient.user.createAccount({
          accountName,
          sourceName,
          providerType: 'xtream',
          credentials: { server: serverUrl, username, password },
          passphrase,
        });
        // Cache passphrase for this account for 5 minutes
        passphraseCache.set(res.accountId, passphrase);
        // Directly fetch catalog from source and store locally
        const sourceId = res.sourceId;
        const client = new XtreamClient({
          server: serverUrl,
          username,
          password,
        });
        const [
          liveCategories,
          vodCategories,
          seriesCategories,
          liveStreams,
          vodStreams,
          seriesList,
        ] = await Promise.all([
          client.getLiveCategories().catch(() => []),
          client.getVodCategories().catch(() => []),
          client.getSeriesCategories().catch(() => []),
          client.getLiveStreams().catch(() => []),
          client.getVodStreams().catch(() => []),
          client.getSeriesList().catch(() => []),
        ]);
        const categories = [
          ...(Array.isArray(liveCategories) ? liveCategories : []).map(
            (cat: any) => ({ ...cat, type: 'live' })
          ),
          ...(Array.isArray(vodCategories) ? vodCategories : []).map(
            (cat: any) => ({ ...cat, type: 'vod' })
          ),
          ...(Array.isArray(seriesCategories) ? seriesCategories : []).map(
            (cat: any) => ({ ...cat, type: 'series' })
          ),
        ];
        const storage = new MobileCatalogStorage();
        await storage.storeSourceCatalog(res.accountId, sourceId, {
          categories,
          movies: Array.isArray(vodStreams) ? vodStreams : [],
          series: Array.isArray(seriesList) ? seriesList : [],
          channels: Array.isArray(liveStreams) ? liveStreams : [],
        });
      } else {
        if (!m3uUrl) throw new Error('M3U URL is required');
        // For M3U, also use provider type 'm3u' and store URL as server
        const res = await apiClient.user.createAccount({
          accountName,
          sourceName,
          providerType: 'm3u',
          credentials: { server: m3uUrl, username: '-', password: '-' },
          passphrase,
        });
        passphraseCache.set(res.accountId, passphrase);
        const sourceId = res.sourceId;
        // Minimal M3U fetch: download playlist text and parse basic lines
        const cleaned = m3uUrl.endsWith('/') ? m3uUrl.slice(0, -1) : m3uUrl;
        const url = cleaned.includes('m3u')
          ? cleaned
          : `${cleaned}/get.php?username=-&password=-&type=m3u_plus&output=m3u8`;
        const text = await fetch(url).then((r) => r.text());
        const channels: any[] = [];
        const lines = text.split(/\r?\n/);
        let current: any = null;
        for (const line of lines) {
          if (line.startsWith('#EXTINF')) {
            const nameMatch = line.split(',');
            current = { name: nameMatch[nameMatch.length - 1] || 'Unknown' };
          } else if (line && !line.startsWith('#')) {
            if (current) {
              current.url = line;
              channels.push(current);
              current = null;
            }
          }
        }
        const storage = new MobileCatalogStorage();
        await storage.storeSourceCatalog(res.accountId, sourceId, {
          categories: [],
          movies: [],
          series: [],
          channels,
        });
      }
      router.replace('/(app)/playlists');
    } catch (e) {
      console.log('Add playlist failed', e);
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1">
      <ScrollView
        className="flex-1 bg-white dark:bg-black"
        contentContainerStyle={{ padding: 16 }}
      >
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            Connect Playlist
          </Text>
          <Pressable
            className="rounded-xl border border-neutral-200 px-4 py-2 dark:border-neutral-800"
            onPress={() => router.back()}
          >
            <Text className="text-neutral-900 dark:text-neutral-50">Back</Text>
          </Pressable>
        </View>

        <View className="flex-row gap-2 mb-4">
          <Pressable
            className={`rounded-xl px-4 py-2 ${mode === 'xtream' ? 'bg-neutral-900' : 'border border-neutral-300 dark:border-neutral-700'}`}
            onPress={() => setMode('xtream')}
          >
            <Text
              className={`${mode === 'xtream' ? 'text-white' : 'text-neutral-900 dark:text-neutral-50'}`}
            >
              IPTV Xtream
            </Text>
          </Pressable>
          <Pressable
            className={`rounded-xl px-4 py-2 ${mode === 'm3u' ? 'bg-neutral-900' : 'border border-neutral-300 dark:border-neutral-700'}`}
            onPress={() => setMode('m3u')}
          >
            <Text
              className={`${mode === 'm3u' ? 'text-white' : 'text-neutral-900 dark:text-neutral-50'}`}
            >
              M3U
            </Text>
          </Pressable>
        </View>

        <View className="gap-3">
          <Input
            label="Account name"
            value={accountName}
            onChangeText={setAccountName}
          />
          <Input
            label="Source name"
            value={sourceName}
            onChangeText={setSourceName}
          />

          {mode === 'xtream' ? (
            <>
              <Input
                label="Server URL"
                value={serverUrl}
                onChangeText={setServerUrl}
              />
              <Input
                label="Username"
                value={username}
                onChangeText={setUsername}
              />
              <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </>
          ) : (
            <Input label="M3U URL" value={m3uUrl} onChangeText={setM3uUrl} />
          )}

          <Input
            label="Passphrase"
            value={passphrase}
            onChangeText={setPassphrase}
            secureTextEntry
          />

          {Platform.OS !== 'web' && (
            <Text className="text-sm text-neutral-600 dark:text-neutral-400">
              Encryption is fully supported. Passphrase will be cached for 5
              minutes.
            </Text>
          )}

          <Pressable
            disabled={submitting}
            className={`mt-2 rounded-xl px-4 py-3 ${submitting ? 'opacity-50' : 'bg-neutral-900'}`}
            onPress={onSubmit}
          >
            <Text className="text-white text-center">
              {submitting ? 'Adding...' : 'Add playlist'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      {submitting && (
        <View className="absolute inset-0 items-center justify-center bg-black/40">
          <View className="rounded-xl bg-white px-6 py-4 dark:bg-neutral-900">
            <Text className="text-neutral-900 dark:text-neutral-50">
              Connecting to source and downloading metadata…
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
