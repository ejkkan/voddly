# Video Player Implementation for Voddly Desktop App

## Problem Statement

We need to play high-quality video content in our Electron desktop app, specifically:

- **HEVC (H.265) 4K videos** with 10-bit color depth
- **EAC3 (Dolby Digital Plus) 5.1 surround sound**
- **Large file sizes** (~23GB for 2h35m movies)
- **High bitrates** (20+ Mbps)

## Research Summary

### Video Requirements Analysis

Based on our F1 movie example:

```json
{
  "video": {
    "codec_name": "hevc",
    "width": 3840,
    "height": 1604,
    "pix_fmt": "yuv420p10le",
    "bitrate": "20246841"
  },
  "audio": {
    "codec_name": "eac3",
    "channels": 6,
    "channel_layout": "5.1(side)",
    "bit_rate": "768000"
  }
}
```

### Player Options Evaluated

#### ❌ Native Electron/HTML5 Video

- **HEVC/H.265**: Not supported (licensing issues)
- **EAC3 5.1**: Limited browser support
- **4K 10-bit**: Too demanding, will stutter
- **Result**: Cannot handle our content

#### ❌ vlc-video Package

- **Status**: Abandoned (last update Jan 2021)
- **Compatibility**: Only Electron 11, Windows x64
- **Maintenance**: No longer maintained
- **Result**: Not viable

#### ⚠️ Capacitor Video Player

- **HEVC**: Platform-dependent
- **EAC3**: Platform-dependent
- **4K**: Possible but demanding
- **Result**: Uncertain compatibility

#### ⚠️ FFmpeg.js (WebAssembly)

- **HEVC**: Supported but CPU-intensive
- **4K transcoding**: 60-100% CPU usage
- **Battery impact**: Significant drain
- **Result**: Poor performance on laptops

#### ✅ External VLC

- **All codecs**: Full support
- **Performance**: Optimized
- **Hardware acceleration**: Available
- **Result**: Best quality but external window

#### ✅ FFmpeg Native Addon (Chosen Solution)

- **HEVC**: Full support with transcoding
- **EAC3**: Full support
- **Performance**: Good with hardware acceleration
- **Integration**: Embedded in app
- **Result**: Best balance of quality and integration

## Chosen Solution: FFmpeg Native Addon

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Website       │───▶│  Electron App    │───▶│  FFmpeg Native  │
│   (React)       │    │  (Main Process)  │    │  (Transcoding)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Video Element   │
                       │  (H.264 + AAC)   │
                       └──────────────────┘
```

### Workflow

1. **Detection**: Analyze video metadata
2. **Decision**: Check if native playback possible
3. **Transcoding**: Convert HEVC→H.264, EAC3→AAC if needed
4. **Streaming**: Stream transcoded content to HTML5 video
5. **Playback**: Native performance with web controls

### Dependencies

- `ffmpeg-static-electron`: Bundled FFmpeg binaries
- `fluent-ffmpeg`: Node.js FFmpeg wrapper
- Native hardware acceleration when available

### Performance Optimizations

- **Hardware acceleration**: GPU decoding when available
- **Preset optimization**: `ultrafast` for real-time transcoding
- **Thread limiting**: Prevent CPU overload
- **Quality balance**: CRF 28 for size/quality trade-off

## Implementation Plan

### Phase 1: Basic Setup ✅

- Install dependencies
- Configure FFmpeg paths
- Set up IPC communication

### Phase 2: Video Service 🔄

- Create transcoding service
- Implement format detection
- Add hardware acceleration

### Phase 3: Integration 📋

- Connect to React frontend
- Add progress indicators
- Handle errors gracefully

### Phase 4: Optimization 📋

- Performance tuning
- Memory management
- User preferences

## Technical Considerations

### Bundle Size Impact

- FFmpeg binaries: ~50MB
- Platform-specific builds required
- Acceptable for desktop app

### Performance Expectations

- **4K HEVC**: 30-50% CPU with hardware acceleration
- **Transcoding latency**: 2-5 seconds startup
- **Memory usage**: 200-500MB during playback

### Platform Support

- **Windows**: Full support (NVENC, Intel QSV)
- **macOS**: Full support (VideoToolbox)
- **Linux**: Full support (VAAPI)

## Fallback Strategy

```javascript
const playbackStrategy = [
  'native-html5', // Try first (0% CPU)
  'ffmpeg-transcode', // Main solution (medium CPU)
  'external-vlc', // Last resort (separate window)
]
```

## Licensing

- FFmpeg: LGPL 2.1+ (compatible with our usage)
- No additional codec licenses required for transcoding

---

## Next Steps

1. Implement FFmpeg service
2. Create IPC handlers
3. Build React video component
4. Add error handling and fallbacks

