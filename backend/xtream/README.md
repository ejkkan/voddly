# Xtream Codes Playlist Analyzer Service

This service connects to Xtream Codes IPTV servers, downloads playlist content, and analyzes the data to provide insights about content size, item counts, and server performance.

## Features

- **Playlist Analysis**: Downloads and analyzes complete Xtream Codes playlists via API or M3U
- **M3U Support**: Direct M3U playlist downloading and parsing with detailed channel information
- **Content Breakdown**: Provides detailed statistics on channels, VOD content, and series
- **Server Fallback**: Automatically tries alternative servers if the primary fails
- **Quick Stats**: Fast server health check and user info retrieval
- **Size Analysis**: Reports data sizes and download performance metrics
- **Dual Analysis Modes**: Choose between Xtream API analysis or M3U playlist analysis

## API Endpoints

### POST `/xtream/analyze`

Performs a complete analysis of the Xtream Codes playlist using either API mode or M3U mode.

**Request Body** (all optional - uses defaults if not provided):

```json
{
  "server": "http://89.37.117.6:2095",
  "username": "ngArk2Up",
  "password": "aSh3J7M",
  "useM3U": false
}
```

- Set `useM3U: true` to download and analyze the M3U playlist instead of using the Xtream API

**Response**:

```json
{
  "totalSize": 1024576,
  "totalChannels": 1500,
  "totalVOD": 8000,
  "totalSeries": 500,
  "downloadTime": 2340,
  "serverUsed": "http://89.37.117.6:2095",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "breakdown": {
    "channels": [...],
    "vodItems": [...],
    "seriesItems": [...]
  }
}
```

### POST `/xtream/quick-stats`

Performs a quick server status check and retrieves basic user information.

**Request Body** (all optional):

```json
{
  "server": "http://89.37.117.6:2095",
  "username": "ngArk2Up",
  "password": "aSh3J7M"
}
```

**Response**:

```json
{
  "serverStatus": "online",
  "serverUsed": "http://89.37.117.6:2095",
  "responseTime": 234,
  "userInfo": {
    // User account information from Xtream API
  }
}
```

### POST `/xtream/analyze-m3u`

Performs M3U playlist analysis directly (dedicated M3U endpoint).

**Request Body** (all optional - uses defaults if not provided):

```json
{
  "server": "http://89.37.117.6:2095",
  "username": "ngArk2Up",
  "password": "aSh3J7M"
}
```

**Response** (same as `/xtream/analyze` but with additional M3U-specific data):

```json
{
  "totalSize": 1048576,
  "totalChannels": 1500,
  "totalVOD": 8000,
  "totalSeries": 500,
  "downloadTime": 3400,
  "serverUsed": "http://89.37.117.6:2095",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "analysisType": "m3u_playlist",
  "breakdown": {...},
  "m3uStats": {
    "totalLines": 32500,
    "validEntries": 10000,
    "playlistSize": 1048576,
    "sampleChannels": [
      {
        "name": "CNN HD",
        "url": "http://server/live/username/password/123.ts",
        "tvgId": "cnn.us",
        "tvgName": "CNN",
        "tvgLogo": "http://logo.url/cnn.png",
        "groupTitle": "News",
        "streamType": "live"
      }
    ]
  }
}
```

### GET `/xtream/server-info`

Returns the default server configuration and credentials.

**Response**:

```json
{
  "servers": ["http://89.37.117.6:2095", "http://nordicstream.xyz:2095"],
  "defaultCredentials": {
    "username": "ngArk2Up",
    "password": "aSh3J7M"
  }
}
```

## Default Configuration

The service comes pre-configured with the provided Xtream Codes credentials:

- **Primary Server**: `http://89.37.117.6:2095`
- **Fallback Server**: `http://nordicstream.xyz:2095`
- **Username**: `ngArk2Up`
- **Password**: `aSh3J7M`

### M3U URL Format

The service automatically constructs M3U URLs in this format:

```
http://server:port/get.php?username=USERNAME&password=PASSWORD&type=m3u_plus
```

For example:

```
http://89.37.117.6:2095/get.php?username=ngArk2Up&password=aSh3J7M&type=m3u_plus
http://nordicstream.xyz:2095/get.php?username=ngArk2Up&password=aSh3J7M&type=m3u_plus
```

## Usage Examples

### Analyze with default credentials (Xtream API)

```bash
curl -X POST http://localhost:4000/xtream/analyze \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Analyze using M3U playlist mode

```bash
curl -X POST http://localhost:4000/xtream/analyze \
  -H "Content-Type: application/json" \
  -d '{"useM3U": true}'
```

### Analyze M3U using dedicated endpoint

```bash
curl -X POST http://localhost:4000/xtream/analyze-m3u \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Analyze with custom server

```bash
curl -X POST http://localhost:4000/xtream/analyze \
  -H "Content-Type: application/json" \
  -d '{"server": "http://nordicstream.xyz:2095"}'
```

### M3U analysis with custom server

```bash
curl -X POST http://localhost:4000/xtream/analyze-m3u \
  -H "Content-Type: application/json" \
  -d '{"server": "http://nordicstream.xyz:2095"}'
```

### Quick server health check

```bash
curl -X POST http://localhost:4000/xtream/quick-stats \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Get server information

```bash
curl http://localhost:4000/xtream/server-info
```

## Logged Information

The service logs detailed information during analysis:

- Server connection attempts and failovers
- API response times and sizes
- Content counts (channels, VOD, series)
- Total data transfer sizes
- Download performance metrics

## Error Handling

- Automatic fallback to secondary server if primary fails
- Graceful handling of network timeouts
- Detailed error messages for debugging
- Non-blocking failures (continues analysis even if some content types fail)

## Testing

Run the test suite:

```bash
npm test xtream.test.ts
```

The tests include:

- Server info retrieval
- Quick stats functionality
- Full playlist analysis (with extended timeout)
