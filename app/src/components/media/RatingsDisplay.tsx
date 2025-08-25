import React, { useMemo } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui';

interface RatingsDisplayProps {
  tmdbRating?: number;
  tmdbVotes?: number;
  imdbRating?: number;
  imdbVotes?: number;
  rottenTomatoesRating?: number;
  metacriticRating?: number;
  traktRating?: number;
  traktVotes?: number;
  localRating?: number; // From IPTV source
}

export function RatingsDisplay(props: RatingsDisplayProps) {
  const {
    tmdbRating,
    tmdbVotes,
    imdbRating,
    imdbVotes,
    rottenTomatoesRating,
    metacriticRating,
    traktRating,
    traktVotes,
    localRating,
  } = props;

  // Calculate Voddly rating as average of all available ratings
  const voddlyRating = useMemo(() => {
    const ratings: number[] = [];

    if (tmdbRating) ratings.push(tmdbRating / 10); // Convert to 0-1 scale
    if (imdbRating) ratings.push(imdbRating / 10);
    if (rottenTomatoesRating) ratings.push(rottenTomatoesRating / 100);
    if (metacriticRating) ratings.push(metacriticRating / 100);
    if (traktRating) ratings.push(traktRating / 10);
    if (localRating) ratings.push(localRating / 5); // Assuming local is 0-5

    if (ratings.length === 0) return null;

    const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    return Math.round(average * 100); // Convert to percentage
  }, [
    tmdbRating,
    imdbRating,
    rottenTomatoesRating,
    metacriticRating,
    traktRating,
    localRating,
  ]);

  const hasAnyRating =
    tmdbRating ||
    imdbRating ||
    rottenTomatoesRating ||
    metacriticRating ||
    traktRating ||
    localRating;

  if (!hasAnyRating) {
    return null;
  }

  return (
    <View className="mt-4">
      <Text className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
        Ratings
      </Text>

      {/* Voddly Rating - Featured */}
      {voddlyRating !== null && (
        <View className="mb-4 rounded-xl bg-gradient-to-r from-purple-600/20 to-blue-600/20 p-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs uppercase text-neutral-600 dark:text-neutral-400">
                Voddly Score
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-500">
                Average of all ratings
              </Text>
            </View>
            <View className="flex-row items-baseline">
              <Text className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
                {voddlyRating}
              </Text>
              <Text className="ml-1 text-lg text-neutral-600 dark:text-neutral-400">
                %
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Individual Ratings Grid */}
      <View className="flex-row flex-wrap gap-3">
        {tmdbRating && (
          <RatingCard
            source="TMDB"
            rating={tmdbRating.toFixed(1)}
            maxRating="10"
            votes={tmdbVotes}
            color="bg-green-600/10"
          />
        )}

        {imdbRating && (
          <RatingCard
            source="IMDb"
            rating={imdbRating.toFixed(1)}
            maxRating="10"
            votes={imdbVotes}
            color="bg-yellow-600/10"
          />
        )}

        {rottenTomatoesRating && (
          <RatingCard
            source="RT"
            rating={`${Math.round(rottenTomatoesRating)}%`}
            color="bg-red-600/10"
            isPercentage
          />
        )}

        {metacriticRating && (
          <RatingCard
            source="Metacritic"
            rating={Math.round(metacriticRating).toString()}
            maxRating="100"
            color="bg-blue-600/10"
          />
        )}

        {traktRating && (
          <RatingCard
            source="Trakt"
            rating={traktRating.toFixed(1)}
            maxRating="10"
            votes={traktVotes}
            color="bg-purple-600/10"
          />
        )}

        {localRating && (
          <RatingCard
            source="Source"
            rating={localRating.toFixed(1)}
            maxRating="5"
            color="bg-neutral-600/10"
          />
        )}
      </View>
    </View>
  );
}

function RatingCard({
  source,
  rating,
  maxRating,
  votes,
  color,
  isPercentage = false,
}: {
  source: string;
  rating: string;
  maxRating?: string;
  votes?: number;
  color: string;
  isPercentage?: boolean;
}) {
  return (
    <View className={`flex-1 min-w-[100px] rounded-lg p-3 ${color}`}>
      <Text className="mb-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">
        {source}
      </Text>
      <View className="flex-row items-baseline">
        <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          {rating}
        </Text>
        {!isPercentage && maxRating && (
          <Text className="ml-1 text-sm text-neutral-600 dark:text-neutral-400">
            /{maxRating}
          </Text>
        )}
      </View>
      {votes && (
        <Text className="mt-1 text-xs text-neutral-500">
          {votes.toLocaleString()} votes
        </Text>
      )}
    </View>
  );
}
