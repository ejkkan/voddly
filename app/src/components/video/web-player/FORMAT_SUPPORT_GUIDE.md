# Video Format Support System Guide

## Overview

This system provides comprehensive subtitle and audio track support for different video formats (MKV, MP4, M4V, AVI, WebM) in your web player. It automatically detects format capabilities and provides user-friendly controls for track selection.

## 🎯 What This System Provides

### 1. **Clear Format Support Indicators**

- **Visual indicators** showing which formats support what features
- **Support levels**: Excellent (MKV), Good (MP4/M4V/WebM), Limited (AVI), Poor
- **Real-time analysis** of embedded tracks in video files

### 2. **Guided Code Flow**

- **Automatic detection** of video container format
- **Track analysis** using FFmpeg backend
- **Smart recommendations** based on format capabilities

### 3. **Enhanced Player UI**

- **Format support indicator** above video player
- **Enhanced subtitle modal** with embedded + external tracks
- **Audio track selection** modal with quality information
- **Smart controls** that adapt to available features

## 🔄 System Flow

```
Video URL → Format Detection → Track Analysis → UI Updates → User Interaction
     ↓              ↓              ↓            ↓            ↓
  Stream URL → useFormatSupport → Backend API → Components → Track Selection
```

### Step-by-Step Flow:

1. **Video Load**: `WebPlayer` receives video URL
2. **Format Analysis**: `useFormatSupport` hook analyzes the stream
3. **Backend Detection**: Calls `detectEmbeddedTracks` API endpoint
4. **Support Assessment**: Determines format capabilities and support level
5. **UI Updates**: Updates player controls and shows format indicator
6. **User Interaction**: Users can select tracks based on available options

## 🏗️ Architecture Components

### Core Hooks

#### `useFormatSupport(url: string)`

- **Purpose**: Analyzes video format and track support
- **Returns**: Format info, support level, available tracks
- **Usage**: Automatically called when video URL changes

```typescript
const { formatInfo, isLoading, error } = useFormatSupport(streamUrl);
```

### UI Components

#### `FormatSupportIndicator`

- **Purpose**: Shows format capabilities and track availability
- **Features**: Expandable details, track selection, recommendations
- **Location**: Above video player in controls

#### `EnhancedSubtitleModal`

- **Purpose**: Unified subtitle selection (embedded + external)
- **Features**: Tabbed interface, format info, track details
- **Usage**: Replaces basic subtitle modal

#### `AudioTrackModal`

- **Purpose**: Audio track selection with quality information
- **Features**: Language, codec, channel info, recommendations
- **Usage**: New modal for audio track selection

## 📊 Format Support Matrix

| Format   | Subtitle Support | Audio Tracks | Support Level | Notes                   |
| -------- | ---------------- | ------------ | ------------- | ----------------------- |
| **MKV**  | ✅ All formats   | ✅ Multiple  | 🟢 Excellent  | Best for IPTV           |
| **MP4**  | ⚠️ TTXT only     | ✅ Multiple  | 🟦 Good       | Universal compatibility |
| **M4V**  | ⚠️ TTXT only     | ✅ Multiple  | 🟦 Good       | Apple optimized         |
| **WebM** | ✅ WebVTT        | ✅ Multiple  | 🟦 Good       | Web optimized           |
| **AVI**  | ❌ Limited       | ⚠️ Basic     | 🟡 Limited    | Legacy format           |

## 🎮 User Experience Features

### Format Indicator

- **Container format** display (MKV, MP4, etc.)
- **Support level** badge (Excellent, Good, Limited, Poor)
- **Track counts** for subtitles and audio
- **Expandable details** with recommendations

### Enhanced Controls

- **Smart button visibility** based on available features
- **Format-aware** subtitle and audio selection
- **Quality indicators** for audio tracks
- **Recommendations** for better experience

### Track Selection

- **Embedded tracks** from video file
- **External subtitles** from your database
- **Audio quality** information (codec, channels)
- **Language detection** and display

## 🔧 Implementation Details

### Backend Integration

The system uses your existing backend endpoints:

```typescript
// Detects embedded tracks in any video format
const response = await apiClient.metadata.detectEmbeddedTracks({
  streamUrl,
  quickScan: true, // Fast analysis for UI
});
```

### Frontend State Management

```typescript
// Format support state
const { formatInfo, isLoading, error } = useFormatSupport(url);

// Player state integration
const playerState = {
  // ... existing state
  formatInfo, // New format support info
  hasEmbeddedSubtitles: formatInfo?.hasEmbeddedSubtitles,
  hasMultipleAudioTracks: formatInfo?.hasMultipleAudioTracks,
};
```

### Component Integration

```typescript
// In WebPlayer
<FormatSupportIndicator
  formatInfo={formatInfo}
  onTrackSelect={(type, trackIndex) => {
    // Handle track selection
  }}
/>

// In ControlsBar
<ControlsBar
  // ... existing props
  formatInfo={formatInfo}
  hasMultipleAudioTracks={formatInfo?.hasMultipleAudioTracks}
  hasEmbeddedSubtitles={formatInfo?.hasEmbeddedSubtitles}
/>
```

## 🚀 Usage Examples

### Basic Implementation

```typescript
import { useFormatSupport } from './hooks/useFormatSupport';
import { FormatSupportIndicator } from './components/FormatSupportIndicator';

function VideoPlayer({ url }) {
  const { formatInfo } = useFormatSupport(url);

  return (
    <div>
      {formatInfo && (
        <FormatSupportIndicator formatInfo={formatInfo} />
      )}
      <video src={url} />
    </div>
  );
}
```

### Track Selection Handling

```typescript
const handleTrackSelect = (type: 'audio' | 'subtitle', trackIndex: number) => {
  if (type === 'subtitle') {
    // Apply subtitle track
    applySubtitleTrack(trackIndex);
  } else if (type === 'audio') {
    // Switch audio track
    switchAudioTrack(trackIndex);
  }
};
```

## 🔍 Troubleshooting

### Common Issues

1. **Format detection fails**
   - Check if stream URL is accessible
   - Verify backend FFmpeg installation
   - Check network connectivity

2. **Tracks not showing**
   - Ensure video has embedded tracks
   - Check format compatibility
   - Verify API endpoint responses

3. **UI not updating**
   - Check React state updates
   - Verify component props
   - Check console for errors

### Debug Information

```typescript
// Enable debug logging
console.log('Format Info:', formatInfo);
console.log('Support Level:', formatInfo?.supportLevel);
console.log('Available Tracks:', {
  subtitles: formatInfo?.subtitleTracks.length,
  audio: formatInfo?.audioTracks.length,
});
```

## 🔮 Future Enhancements

### Planned Features

- **Format conversion** recommendations
- **Quality comparison** between formats
- **User preferences** for track selection
- **Batch analysis** for multiple videos

### Integration Opportunities

- **Video metadata** enhancement
- **User experience** analytics
- **Content optimization** suggestions
- **Format standardization** tools

## 📚 Related Files

- **Hook**: `useFormatSupport.ts`
- **Components**:
  - `FormatSupportIndicator.tsx`
  - `EnhancedSubtitleModal.tsx`
  - `AudioTrackModal.tsx`
- **Integration**: `WebPlayer.tsx`, `ControlsBar.tsx`
- **Backend**: `detectEmbeddedTracks` API endpoint

## 🎉 Benefits

1. **User Experience**: Clear understanding of video capabilities
2. **Accessibility**: Better subtitle and audio track access
3. **Performance**: Smart format-aware controls
4. **Maintenance**: Centralized format support logic
5. **Scalability**: Easy to add new formats and features

This system transforms your video player from a basic player into a smart, format-aware experience that guides users to the best possible viewing experience based on their video's capabilities.
