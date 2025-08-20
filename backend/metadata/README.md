# Metadata Service

This service provides integration with various metadata providers (currently TMDB) for fetching and caching metadata about movies, TV shows, seasons, and episodes.

## Configuration

The service requires a TMDB API Access Token to be set as a secret:

```bash
encore secret set --type prod TMDBAccessToken "your_access_token_here"
encore secret set --type dev TMDBAccessToken "your_access_token_here"
```

You can get an access token from https://www.themoviedb.org/settings/api

## Endpoints

### Get Metadata

Fetches metadata for a specific TMDB ID. Caches results for 24 hours by default.

```
GET /tmdb/metadata
```

Parameters:
- `tmdb_id` (required): The TMDB ID
- `content_type` (required): Type of content ('movie', 'tv', 'season', 'episode')
- `season_number` (optional): Required for 'season' and 'episode' types
- `episode_number` (optional): Required for 'episode' type
- `force_refresh` (optional): Force refresh from API, ignoring cache
- `append_to_response` (optional): Additional data to fetch (e.g., "videos,images,credits")

Example:
```bash
# Get movie metadata with videos and images
curl "http://localhost:4000/tmdb/metadata?tmdb_id=550&content_type=movie&append_to_response=videos,images"

# Get TV show metadata
curl "http://localhost:4000/tmdb/metadata?tmdb_id=1399&content_type=tv"

# Get season metadata
curl "http://localhost:4000/tmdb/metadata?tmdb_id=1399&content_type=season&season_number=1"

# Get episode metadata
curl "http://localhost:4000/tmdb/metadata?tmdb_id=1399&content_type=episode&season_number=1&episode_number=1"
```

### Search

Search for content on TMDB.

```
GET /tmdb/search
```

Parameters:
- `query` (required): Search query
- `content_type` (required): Type of content to search ('movie', 'tv')
- `year` (optional): Filter by release year
- `page` (optional): Page number (default: 1)
- `language` (optional): Language code (default: 'en-US')

Example:
```bash
# Search for movies
curl "http://localhost:4000/tmdb/search?query=inception&content_type=movie"

# Search for TV shows
curl "http://localhost:4000/tmdb/search?query=breaking%20bad&content_type=tv"
```

## Database Schema

The service uses a PostgreSQL database to cache TMDB metadata. The schema includes:

- Support for movies, TV shows, seasons, and episodes
- Full metadata storage including cast, crew, videos, images
- Automatic cache invalidation after 24 hours
- Parent-child relationships for TV show hierarchies

## Cache Management

- Results are cached for 24 hours by default
- Use `force_refresh=true` to bypass cache
- The service stores the complete API response for flexibility
- Indexes ensure fast lookups by TMDB ID and content type

## Integration with Other Services

This service can be used by other services to enrich content with metadata:

```typescript
import { getMetadata } from "~encore/clients/tmdb";

// In another service
const metadata = await getMetadata({
  tmdb_id: 550,
  content_type: 'movie',
  append_to_response: 'videos,credits'
});
```