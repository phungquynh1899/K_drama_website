# HLS Streaming Endpoint Test

## Overview
The new `/api/v1/stream/hls/:videoId` endpoint integrates with the existing stream service mode system.

## Endpoints Created

### 1. HLS Playlist Streaming
```
GET /api/v1/stream/hls/:videoId
```

**Behavior:**
- ✅ **Mode Check**: Returns 503 if `currentMode !== 'streaming'`
- ✅ **Playlist Update**: Updates .m3u8 file with proper streaming URLs
- ✅ **Headers**: Sets correct MIME type and caching headers

### 2. HLS Segment Serving
```
GET /api/v1/stream/hls/:videoId/segment/:segmentName
```

**Behavior:**
- ✅ **Mode Check**: Returns 503 if `currentMode !== 'streaming'`
- ✅ **File Serving**: Serves .ts segment files
- ✅ **Headers**: Sets correct MIME type and caching headers

## Mode Integration

### Current Modes (from stream.service.js):
- `'streaming'` - Server can handle video streaming
- `'waiting-for-upload'` - Waiting for active streams to finish
- `'uploading'` - Server is in upload mode

### Response Examples:

**When in streaming mode:**
```json
// GET /api/v1/stream/hls/1752246753559282700
// Status: 200
// Content-Type: application/vnd.apple.mpegurl

#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:8
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:8.333333,
/api/v1/stream/hls/1752246753559282700/segment/segment_000.ts
#EXTINF:8.333333,
/api/v1/stream/hls/1752246753559282700/segment/segment_001.ts
#EXT-X-ENDLIST
```

**When in upload mode:**
```json
// GET /api/v1/stream/hls/1752246753559282700
// Status: 503
{
  "error": "Server temporarily unavailable",
  "mode": "uploading",
  "message": "Server is currently in upload mode"
}
```

## Testing the Endpoint

### 1. Test with existing HLS video:
```bash
# Test playlist streaming
curl http://localhost:3000/api/v1/stream/hls/1752246753559282700

# Test segment serving
curl http://localhost:3000/api/v1/stream/hls/1752246753559282700/segment/segment_000.ts
```

### 2. Test mode switching:
```bash
# Check current mode
curl http://localhost:3000/api/v1/stream/status

# The endpoint will return 503 when server is in upload mode
# and 200 when in streaming mode
```

## Integration with Load Balancer

The 503 status code tells nginx that this server is temporarily unavailable:

```nginx
# Nginx configuration example
upstream streaming_servers {
    server server1:3000 max_fails=3 fail_timeout=30s;
    server server2:3000 max_fails=3 fail_timeout=30s;
    server server3:3000 max_fails=3 fail_timeout=30s;
}

location /api/v1/stream/hls/ {
    proxy_pass http://streaming_servers;
    proxy_next_upstream error timeout http_503;
}
```

## Workflow Example

1. **User requests video**: `GET /api/v1/stream/hls/1752246753559282700`
2. **Server checks mode**: `streamService.getMode()`
3. **If streaming mode**: 
   - Read `src/public/hls/1752246753559282700/playlist.m3u8`
   - Update segment URLs to use our endpoints
   - Return modified playlist
4. **If upload mode**: 
   - Return 503 status
   - Load balancer routes to another server

## Files Created

- `src/routes/videostreaming/hls.router.js` - HLS routes
- `src/controllers/videostreaming/hls.controller.js` - HLS controller with mode checking
- `src/services/videostreaming/hls.service.js` - HLS business logic

## Integration Points

- ✅ **No changes** to existing `stream.service.js` logic
- ✅ **Uses** `streamService.getMode()` for mode checking
- ✅ **Returns** 503 for load balancer when in upload mode
- ✅ **Updates** .m3u8 playlists with proper streaming URLs 