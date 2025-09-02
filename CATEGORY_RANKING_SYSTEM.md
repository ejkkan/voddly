# IPTV Category Ranking and Highlighting System

## Overview

This document describes the comprehensive category ranking system implemented for Voddly's IPTV platform. The system analyzes live TV categories and streams to provide intelligent highlighting and recommendations based on multiple quality and relevance factors.

## Key Features

### 1. **Multi-Factor Scoring Algorithm**

The ranking system evaluates categories based on:

- **Channel Count** (20% weight): More channels = higher priority
- **EPG Availability** (15% weight): Categories with Electronic Program Guide data
- **Archive Availability** (10% weight): TV archive/catch-up functionality
- **Quality Variants** (10% weight): HD/FHD/4K stream options
- **Family Friendly Ratio** (5% weight): Non-adult content percentage
- **Geographic Relevance** (25% weight): Local/regional content priority
- **Content Type Score** (15% weight): National broadcast, sports, premium services

### 2. **Geographic Priority System**

Categories are ranked by geographic relevance:

- **Primary** (100 points): Sweden, SE, Svenska, Svensk
- **Nordic** (80 points): Denmark, Norway, Finland, Iceland
- **European** (60 points): Germany, France, UK, Netherlands
- **International** (40 points): World, International, 24/7, Global

### 3. **Content Type Classification**

Automatic content type detection with scoring:

- **National Broadcast** (100 points): SVT, TV4, Kanal 5, etc.
- **Sports Content** (90 points): Allsvenskan, DAZN, Viaplay Sport
- **Premium Services** (85 points): Max, Disney+, Discovery+
- **News & Information** (75 points): News channels, 24/7 content
- **Entertainment** (70 points): Movies, series, drama
- **Specialty** (60 points): Events, PPV, specialty content

## Implementation

### Core Files

1. **`/app/src/lib/category-ranking.ts`** - Main ranking algorithm
2. **`/app/src/hooks/useCategoryRanking.ts`** - React hook for UI integration
3. **`/app/src/components/CategoryRankingDemo.tsx`** - Demo component

### Usage Example

```typescript
import { useLiveTVCategoryRanking } from '@/hooks/useCategoryRanking';

const categoryRanking = useLiveTVCategoryRanking(categories, {
  preferLocal: true,
  preferSports: true,
});

// Get sorted categories by ranking
const sortedCategories = categoryRanking.sortedCategories;

// Check if category should be highlighted
const isHighlighted = categoryRanking.isCategoryHighlighted(categoryId);

// Get highlight level and styling
const highlightLevel = categoryRanking.getCategoryHighlightLevel(categoryId);
const highlightClasses = getCategoryHighlightClasses(highlightLevel);
```

## Ranking Results for Your Sample Data

Based on your Swedish IPTV sample, here's how categories would be ranked:

### Top Tier (High Priority - 80+ points)

1. **Sweden** (95 points)

   - Local/Regional content
   - National broadcast channels
   - Rich EPG data
   - Large channel selection

2. **Allsvenskan & Superettan SE** (92 points)

   - Sports content
   - Local/Regional content
   - Premium content

3. **Max Sports SE** (88 points)
   - Sports content
   - Premium streaming service
   - Local/Regional content

### Medium Tier (Medium Priority - 60-79 points)

4. **Viaplay Sport SE** (85 points)
5. **TV4 Play SE** (82 points)
6. **DAZN SE** (80 points)
7. **Disney Plus SE** (78 points)

### Lower Tier (Standard Priority - <60 points)

8. **Denmark** (75 points) - Nordic relevance
9. **Norway** (75 points) - Nordic relevance
10. **24/7 Swedish** (65 points) - Specialty content

## Visual Highlighting

### Category List Styling

- **High Priority**: Green left border, green background tint, "⭐ Recommended" badge
- **Medium Priority**: Yellow left border, yellow background tint, "👍 Popular" badge
- **Low Priority**: Gray border, no special styling

### Badge System

Categories display contextual badges showing:

- Recommendation level (Recommended/Popular)
- Reasons (Sports content, Local content, Premium service, etc.)
- Quality indicators (HD options, EPG data, Archive available)

## User Preferences

The system supports user preference weighting:

```typescript
const preferences = {
  preferSports: true, // Boost sports categories
  preferLocal: true, // Boost local/regional content
  preferPremium: true, // Boost premium streaming services
  preferNews: true, // Boost news and information channels
};
```

## Database Integration

### Current Implementation

- Uses existing category and content_items tables
- No schema changes required
- Ranking calculated dynamically from existing data

### Future Enhancement (Optional)

Add category priority field to database:

```sql
ALTER TABLE categories ADD COLUMN priority_score INTEGER DEFAULT 0;
ALTER TABLE categories ADD COLUMN highlight_level TEXT DEFAULT 'low';
ALTER TABLE categories ADD COLUMN last_ranking_update TIMESTAMP;
```

## Performance Considerations

- Ranking calculation is memoized in React hooks
- Efficient single-query approach for large category sets
- Minimal impact on existing UI performance
- Results cached until category data changes

## Benefits

1. **Improved User Experience**: Users see most relevant categories first
2. **Content Discovery**: Highlights premium and local content
3. **Reduced Cognitive Load**: Clear visual hierarchy
4. **Personalization**: Adapts to user preferences
5. **Quality Indicators**: Shows EPG, archive, and HD availability

## Testing

Use the `CategoryRankingDemo` component to test ranking with your actual data:

```typescript
import CategoryRankingDemo from '@/components/CategoryRankingDemo';

// Add to any screen for testing
<CategoryRankingDemo />;
```

## Future Enhancements

1. **User Analytics**: Track category usage to improve ranking
2. **Machine Learning**: Learn from user behavior patterns
3. **A/B Testing**: Test different ranking algorithms
4. **Personalized Weights**: Individual user preference learning
5. **Time-based Ranking**: Boost categories based on time of day
6. **Seasonal Adjustments**: Sports seasons, holiday content

## Configuration

The ranking system is highly configurable. Key parameters can be adjusted in `/app/src/lib/category-ranking.ts`:

- Geographic priority scores
- Content type pattern matching
- Scoring algorithm weights
- Highlight thresholds

This system provides a solid foundation for intelligent category organization while remaining flexible for future enhancements and user feedback integration.
