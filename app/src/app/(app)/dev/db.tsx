import React, { useEffect, useState } from 'react';

import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { openDb } from '@/lib/db';
import { resetDatabase } from '@/lib/db/migrations';

type Row = Record<string, any>;

export default function DbInspector() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<Row[]>([]);
  const [counts, setCounts] = useState<{ label: string; count: number }[]>([]);
  const [categories, setCategories] = useState<Row[]>([]);
  const [recentItems, setRecentItems] = useState<Row[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<
    'movie' | 'series' | 'live' | null
  >(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const db = await openDb();

      const tbls = await db.getAllAsync(
        `SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name ASC`
      );
      setTables(tbls as Row[]);

      const whereSource = selectedSource ? ` AND source_id = $src` : '';
      const whereType = selectedType ? ` AND type = $typ` : '';
      const paramsCounts: Record<string, unknown> = {};
      if (selectedSource) paramsCounts.$src = selectedSource;
      if (selectedType) paramsCounts.$typ = selectedType;

      const [[mc], [sc], [lc]] = await Promise.all([
        db.getAllAsync(
          `SELECT COUNT(1) as c FROM content_items WHERE type='movie'${selectedSource ? ' AND source_id = $src' : ''}`,
          ...(selectedSource ? [selectedSource] : [])
        ) as any,
        db.getAllAsync(
          `SELECT COUNT(1) as c FROM content_items WHERE type='series'${selectedSource ? ' AND source_id = $src' : ''}`,
          ...(selectedSource ? [selectedSource] : [])
        ) as any,
        db.getAllAsync(
          `SELECT COUNT(1) as c FROM content_items WHERE type='live'${selectedSource ? ' AND source_id = $src' : ''}`,
          ...(selectedSource ? [selectedSource] : [])
        ) as any,
      ]);

      // Categories count (filter by source prefix in id)
      const categoriesCountQuery = selectedSource
        ? `SELECT COUNT(1) as c FROM categories WHERE id LIKE $src_like`
        : `SELECT COUNT(1) as c FROM categories`;
      const categoriesCountParams = selectedSource
        ? { $src_like: `${selectedSource}:%` }
        : undefined;
      const [[cc]] = (await Promise.all([
        db.getAllAsync(categoriesCountQuery, categoriesCountParams as any),
      ])) as any;

      setCounts([
        { label: 'movies', count: Number(mc?.c || 0) },
        { label: 'series', count: Number(sc?.c || 0) },
        { label: 'live', count: Number(lc?.c || 0) },
        { label: 'categories', count: Number(cc?.c || 0) },
      ]);

      const catsQuery = selectedSource
        ? `SELECT id, name, type FROM categories WHERE id LIKE $src_like ORDER BY name ASC LIMIT 50`
        : `SELECT id, name, type FROM categories ORDER BY name ASC LIMIT 50`;
      const catsParams = selectedSource
        ? { $src_like: `${selectedSource}:%` }
        : undefined;
      const cats = await db.getAllAsync(catsQuery, catsParams as any);
      setCategories(cats as Row[]);

      const itemsParams: any[] = [];
      if (selectedSource) itemsParams.push(selectedSource);
      if (selectedType) itemsParams.push(selectedType);
      const items = await db.getAllAsync(
        `SELECT id, source_id, type, title, added_at
         FROM content_items
         WHERE 1=1${whereSource}${whereType}
         ORDER BY datetime(added_at) DESC, title ASC
         LIMIT 50`,
        ...itemsParams
      );
      setRecentItems(items as Row[]);

      // Discover distinct sources present in DB
      const srcRows = await db.getAllAsync(
        `SELECT DISTINCT source_id FROM content_items ORDER BY source_id ASC`
      );
      setSources((srcRows as any[]).map((r) => String(r.source_id)));
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [selectedSource, selectedType]);

  return (
    <SafeAreaView className="flex-1">
      <ScrollView
        className="flex-1 bg-white dark:bg-black"
        contentContainerStyle={{ padding: 16 }}
      >
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            DB Inspector
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              className="rounded-lg border border-red-400 px-3 py-1.5"
              onPress={async () => {
                try {
                  setLoading(true);
                  const db = await openDb();
                  await resetDatabase(db);
                  await load();
                } catch (e) {
                  setError(String((e as any)?.message || e));
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Text className="text-red-600 dark:text-red-400">Empty DB</Text>
            </Pressable>
            <Pressable
              className="rounded-lg border border-neutral-300 px-3 py-1.5 dark:border-neutral-700"
              onPress={() => {
                setSelectedSource(null);
                setSelectedType(null);
                void load();
              }}
            >
              <Text className="text-neutral-900 dark:text-neutral-50">
                Clear Filters
              </Text>
            </Pressable>
            <Pressable
              className="rounded-lg border border-neutral-300 px-3 py-1.5 dark:border-neutral-700"
              onPress={load}
            >
              <Text className="text-neutral-900 dark:text-neutral-50">
                Reload
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Filters */}
        <View className="mb-4 gap-2">
          <Text className="text-neutral-700 dark:text-neutral-300">
            Filter by Source:
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {sources.map((s) => (
              <Pressable
                key={s}
                className={`rounded-lg border px-2 py-1 ${selectedSource === s ? 'border-neutral-900 dark:border-neutral-100' : 'border-neutral-300 dark:border-neutral-700'}`}
                onPress={() =>
                  setSelectedSource(selectedSource === s ? null : s)
                }
              >
                <Text className="text-neutral-900 dark:text-neutral-50">
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="mt-3 text-neutral-700 dark:text-neutral-300">
            Filter by Type:
          </Text>
          <View className="flex-row gap-2">
            {(['movie', 'series', 'live'] as const).map((t) => (
              <Pressable
                key={t}
                className={`rounded-lg border px-2 py-1 ${selectedType === t ? 'border-neutral-900 dark:border-neutral-100' : 'border-neutral-300 dark:border-neutral-700'}`}
                onPress={() => setSelectedType(selectedType === t ? null : t)}
              >
                <Text className="text-neutral-900 dark:text-neutral-50">
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {loading ? (
          <Text className="text-neutral-900 dark:text-neutral-50">
            Loading…
          </Text>
        ) : error ? (
          <Text className="text-red-600 dark:text-red-400">{error}</Text>
        ) : (
          <View className="gap-6">
            <View>
              <Text className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                Counts
              </Text>
              {counts.map((c) => (
                <Text
                  key={c.label}
                  className="text-neutral-700 dark:text-neutral-300"
                >
                  {c.label}: {c.count}
                </Text>
              ))}
            </View>

            <View>
              <Text className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                Tables
              </Text>
              {tables.map((t) => (
                <View key={String(t.name)} className="mb-2">
                  <Text className="font-medium text-neutral-900 dark:text-neutral-50">
                    {String(t.name)}
                  </Text>
                  <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                    {String(t.sql || '').slice(0, 300)}
                  </Text>
                </View>
              ))}
            </View>

            <View>
              <Text className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                Categories (50)
              </Text>
              {categories.map((c) => (
                <Text
                  key={String(c.id)}
                  className="text-neutral-700 dark:text-neutral-300"
                >
                  {String(c.id)} — {String(c.type)} — {String(c.name)}
                </Text>
              ))}
            </View>

            <View>
              <Text className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                Recent Items (50)
              </Text>
              {recentItems.map((i) => (
                <Text
                  key={String(i.id)}
                  className="text-neutral-700 dark:text-neutral-300"
                >
                  {String(i.id)} — {String(i.type)} — {String(i.title)} —{' '}
                  {String(i.added_at || '')}
                </Text>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
