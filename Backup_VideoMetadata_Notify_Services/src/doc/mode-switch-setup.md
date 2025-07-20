# Mode Switch Setup Guide

## Overview
This feature allows the old PC to automatically request the laptop to switch to upload mode when all chunks have been received.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install axios
```

### 2. Configure Laptop IP Address
Edit `src/config/laptop-config.js` and update the laptop's IP address:

```javascript
laptop: {
  baseUrl: process.env.LAPTOP_BASE_URL || 'http://192.168.1.100:3000', // Update this IP
  // ...
}
```

### 3. Environment Variables (Optional)
You can also set the laptop URL via environment variable:
```bash
export LAPTOP_BASE_URL=http://192.168.1.100:3000
```

### 4. Ensure Laptop is Running
Make sure your laptop server is running and accessible at the configured IP address.

## How It Works

### Automatic Mode Switch
When a file upload completes (all chunks received):

1. **Old PC** verifies all chunks are present
2. **Old PC** sends HTTP request to laptop: `POST /api/v1/mode/switch`
3. **Laptop** receives request and switches to upload mode
4. **Old PC** receives confirmation and logs the result

### Request Format
```json
{
  "action": "switch_to_upload_mode",
  "uploadId": "upload_1234567890_abc123",
  "totalChunks": 5,
  "filename": "video.mp4",
  "chunkDirectory": "/path/to/chunks",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "source": "old_pc_upload_service"
}
```

### Response Format
```json
{
  "success": true,
  "response": {
    "message": "Mode switched to upload",
    "previousMode": "streaming",
    "currentMode": "upload",
    "uploadId": "upload_1234567890_abc123"
  },
  "statusCode": 200,
  "attempts": 1
}
```

## Testing

### 1. Test Mode Switch Manually
```bash
curl -X POST http://localhost:3000/api/v1/upload/test-mode-switch \
  -H "Content-Type: application/json" \
  -d '{
    "uploadId": "test_upload_123",
    "totalChunks": 3,
    "filename": "test_video.mp4",
    "chunkDirectory": "/path/to/test/chunks"
  }'
```

### 2. Check Laptop Status
```bash
curl http://localhost:3000/api/v1/upload/chunks/test_upload_123
```

### 3. Monitor Logs
Watch the console output for mode switch attempts and results.

## Error Handling

### Network Issues
- **Retry Logic**: Up to 3 attempts with exponential backoff
- **Timeout**: 10 seconds per attempt
- **Graceful Degradation**: Upload completes even if laptop is unreachable

### Common Issues
1. **Laptop not accessible**: Check IP address and network connectivity
2. **Laptop server not running**: Start the laptop server first
3. **Firewall blocking**: Ensure port 3000 is open on laptop
4. **Wrong IP address**: Update configuration with correct laptop IP

## Configuration Options

### Timeouts
```javascript
timeouts: {
  modeSwitch: 10000,  // 10 seconds
  healthCheck: 5000,  // 5 seconds
  general: 8000       // 8 seconds
}
```

### Retry Settings
```javascript
retry: {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2
}
```

## Laptop Requirements

Your laptop server should implement these endpoints:

1. **POST /api/v1/mode/switch** - Handle mode switch requests
2. **GET /api/v1/health** - Health check endpoint
3. **GET /api/v1/mode/current** - Get current mode

## Troubleshooting

### Check Laptop Connectivity
```bash
# Test if laptop is reachable
ping 192.168.1.100

# Test HTTP connectivity
curl http://192.168.1.100:3000/api/v1/health
```

### Debug Mode Switch
```bash
# Test mode switch manually
curl -X POST http://localhost:3000/api/v1/upload/test-mode-switch \
  -H "Content-Type: application/json" \
  -d '{"uploadId": "debug_test"}'
```

### Monitor Network
```bash
# Watch network traffic
tcpdump -i any host 192.168.1.100
```

## Security Considerations

1. **Network Security**: Ensure both PCs are on the same secure network
2. **Authentication**: Consider adding API keys or tokens for production
3. **Validation**: Validate all incoming requests on the laptop
4. **Logging**: Monitor mode switch requests for suspicious activity 