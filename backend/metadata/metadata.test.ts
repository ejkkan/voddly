import { describe, expect, test, beforeAll } from "vitest";
import { getMetadata, search } from "./tmdb";
import { ContentType } from "./types";

describe("TMDB Service", () => {
  // Note: These are integration tests that require a valid TMDB API token
  // Set the token with: encore secret set --type dev TMDBAccessToken "your_token"
  
  describe("getMetadata", () => {
    test("should fetch and cache movie metadata", async () => {
      const result = await getMetadata({
        tmdb_id: 550, // Fight Club
        content_type: "movie" as ContentType,
      });

      expect(result).toBeDefined();
      expect(result.tmdb_id).toBe(550);
      expect(result.content_type).toBe("movie");
      expect(result.title).toBe("Fight Club");
      expect(result.release_date).toBeTruthy();
      expect(result.overview).toBeTruthy();
    });

    test("should fetch movie with additional data", async () => {
      const result = await getMetadata({
        tmdb_id: 550,
        content_type: "movie" as ContentType,
        append_to_response: "videos,credits",
      });

      expect(result).toBeDefined();
      expect(result.videos).toBeDefined();
      expect(result.cast).toBeDefined();
      expect(result.crew).toBeDefined();
    });

    test("should fetch and cache TV show metadata", async () => {
      const result = await getMetadata({
        tmdb_id: 1399, // Breaking Bad
        content_type: "tv" as ContentType,
      });

      expect(result).toBeDefined();
      expect(result.tmdb_id).toBe(1399);
      expect(result.content_type).toBe("tv");
      expect(result.title).toBe("Breaking Bad");
      expect(result.number_of_seasons).toBeGreaterThan(0);
      expect(result.number_of_episodes).toBeGreaterThan(0);
    });

    test("should fetch season metadata", async () => {
      const result = await getMetadata({
        tmdb_id: 1399, // Breaking Bad
        content_type: "season" as ContentType,
        season_number: 1,
      });

      expect(result).toBeDefined();
      expect(result.content_type).toBe("season");
      expect(result.season_number).toBe(1);
      expect(result.parent_tmdb_id).toBe(1399);
    });

    test("should fetch episode metadata", async () => {
      const result = await getMetadata({
        tmdb_id: 1399, // Breaking Bad
        content_type: "episode" as ContentType,
        season_number: 1,
        episode_number: 1,
      });

      expect(result).toBeDefined();
      expect(result.content_type).toBe("episode");
      expect(result.season_number).toBe(1);
      expect(result.episode_number).toBe(1);
      expect(result.parent_tmdb_id).toBe(1399);
    });

    test("should use cached data on second request", async () => {
      // First request - will fetch from API
      const firstResult = await getMetadata({
        tmdb_id: 550,
        content_type: "movie" as ContentType,
      });

      // Second request - should use cache
      const secondResult = await getMetadata({
        tmdb_id: 550,
        content_type: "movie" as ContentType,
      });

      expect(secondResult).toEqual(firstResult);
    });

    test("should refresh data when force_refresh is true", async () => {
      const result = await getMetadata({
        tmdb_id: 550,
        content_type: "movie" as ContentType,
        force_refresh: true,
      });

      expect(result).toBeDefined();
      expect(result.fetched_at).toBeDefined();
    });
  });

  describe("search", () => {
    test("should search for movies", async () => {
      const result = await search({
        query: "inception",
        content_type: "movie" as ContentType,
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.total_results).toBeGreaterThan(0);
    });

    test("should search for TV shows", async () => {
      const result = await search({
        query: "breaking bad",
        content_type: "tv" as ContentType,
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
    });

    test("should support pagination", async () => {
      const page1 = await search({
        query: "star",
        content_type: "movie" as ContentType,
        page: 1,
      });

      const page2 = await search({
        query: "star",
        content_type: "movie" as ContentType,
        page: 2,
      });

      expect(page1.page).toBe(1);
      expect(page2.page).toBe(2);
      expect(page1.results[0]).not.toEqual(page2.results[0]);
    });

    test("should filter by year", async () => {
      const result = await search({
        query: "inception",
        content_type: "movie" as ContentType,
        year: 2010,
      });

      expect(result).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
    });
  });
});