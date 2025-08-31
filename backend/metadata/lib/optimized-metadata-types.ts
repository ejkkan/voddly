// Optimized metadata types for reduced storage and better performance

export interface ContentRating {
  tmdb_id: number;
  content_type: 'movie' | 'tv' | 'season' | 'episode';
  
  // Normalized score (0-10 scale, weighted average of all sources)
  score_average: number;
  
  // Individual scores in their native formats
  tmdb_score?: number;      // 0-10
  tmdb_votes?: number;
  
  imdb_score?: number;       // 0-10
  imdb_votes?: number;
  
  rotten_tomatoes_score?: number;  // 0-100 percentage
  rotten_tomatoes_fresh?: boolean;
  
  metacritic_score?: number;       // 0-100
  metacritic_color?: 'green' | 'yellow' | 'red';
  
  audience_score?: number;    // 0-10
  audience_votes?: number;
}

export interface MediaAsset {
  url: string;
  language?: string;
  vote_average?: number;
}

export interface Trailer {
  youtube_id: string;
  title: string;
  type: 'Trailer' | 'Teaser' | 'Clip' | 'Featurette';
  official: boolean;
}

export interface ContentMedia {
  tmdb_id: number;
  content_type: string;
  
  // Primary assets
  poster_url?: string;
  backdrop_url?: string;
  logo_url?: string;
  
  // Additional assets (max 5 each)
  posters: MediaAsset[];
  backdrops: MediaAsset[];
  
  // Trailers (max 3)
  trailers: Trailer[];
}

export interface Person {
  id: number;
  name: string;
  profile_path?: string;
}

export interface CastMember extends Person {
  character: string;
  order: number;
}

export interface ContentPeople {
  tmdb_id: number;
  content_type: string;
  
  // Top 10 cast members
  cast: CastMember[];
  
  // Key crew (max 3-5 each)
  directors: Person[];
  writers: Person[];
  producers: Person[];
}

// Helper functions for rating normalization
export class RatingNormalizer {
  // Convert any rating to 0-10 scale
  static normalize(value: number | string, source: 'imdb' | 'tmdb' | 'rt' | 'metacritic' | 'percent'): number {
    if (typeof value === 'string') {
      // Handle percentage strings like "84%"
      value = parseFloat(value.replace('%', ''));
    }
    
    switch (source) {
      case 'imdb':
      case 'tmdb':
        return value; // Already 0-10
        
      case 'rt':
      case 'metacritic':
      case 'percent':
        return value / 10; // Convert 0-100 to 0-10
        
      default:
        return value;
    }
  }
  
  // Calculate weighted average
  static calculateAverage(ratings: {
    tmdb?: number,
    imdb?: number,
    rt?: number,
    metacritic?: number
  }): number | null {
    const weights = {
      tmdb: 1,
      imdb: 2,        // IMDb gets higher weight (more users)
      rt: 1.5,        // RT is critics score
      metacritic: 1.5 // Metacritic is also critics
    };
    
    let weightSum = 0;
    let totalWeight = 0;
    
    for (const [source, score] of Object.entries(ratings)) {
      if (score !== undefined && score !== null) {
        const weight = weights[source as keyof typeof weights] || 1;
        const normalizedScore = source === 'rt' || source === 'metacritic' 
          ? score / 10 
          : score;
        
        weightSum += normalizedScore * weight;
        totalWeight += weight;
      }
    }
    
    return totalWeight > 0 ? Math.round((weightSum / totalWeight) * 10) / 10 : null;
  }
  
  // Get display color based on score
  static getScoreColor(score: number): string {
    if (score >= 7) return '#4ade80'; // green
    if (score >= 5) return '#facc15'; // yellow
    return '#f87171'; // red
  }
  
  // Format score for display
  static formatScore(score: number, format: 'decimal' | 'percent' | 'stars' = 'decimal'): string {
    switch (format) {
      case 'percent':
        return `${Math.round(score * 10)}%`;
      case 'stars':
        return '★'.repeat(Math.round(score / 2)) + '☆'.repeat(5 - Math.round(score / 2));
      default:
        return score.toFixed(1);
    }
  }
}

// Example usage for fetching optimized data
export async function getOptimizedMovieData(tmdbId: number) {
  // Instead of fetching everything, we now fetch only what we need
  const [ratings, media, people] = await Promise.all([
    db.query('SELECT * FROM content_ratings WHERE tmdb_id = $1', [tmdbId]),
    db.query('SELECT * FROM content_media WHERE tmdb_id = $1', [tmdbId]),
    db.query('SELECT * FROM content_people WHERE tmdb_id = $1', [tmdbId])
  ]);
  
  return {
    ratings: ratings.rows[0],
    media: media.rows[0],
    people: people.rows[0]
  };
}

// Storage savings example:
// Before: ~500KB per movie (with raw_response, full images, videos, cast/crew)
// After: ~20KB per movie (optimized data only)
// Reduction: ~96% less storage!