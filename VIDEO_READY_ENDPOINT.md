# Video Ready to Serve Endpoint

## Overview
This endpoint allows server B (processing server) to notify the main server when video processing is complete and the video is ready to be served to users.

## Endpoint Details

**URL:** `POST /videometadata/service/video-ready-to-serve`

**Purpose:** Update video status from "processing" to "ready" and mark upload as completed

## Request Format

### Headers
```
Content-Type: application/json
```

### Body
```json
{
    "videoId": 123
}
```

**Parameters:**
- `videoId` (required): The ID of the video that has completed processing

## Response Format

### Success Response (200 OK)
```json
{
    "status": "OK",
    "message": "Video ready to serve notification processed successfully",
    "metadata": {
        "video": {
            "id": 123,
            "title": "Sample Video",
            "status": "ready",
            "updated_at": "2025-01-15T10:30:00.000Z"
        },
        "message": "Video marked as ready to serve successfully",
        "uploadUpdated": true,
        "tempFolderCleaned": true,
        "transcodingJobsUpdated": 2
    }
}
```

### Error Responses

**400 Bad Request** - Missing videoId
```json
{
    "status": "BAD_REQUEST",
    "message": "Video ID is required."
}
```

**404 Not Found** - Video doesn't exist
```json
{
    "status": "NOT_FOUND", 
    "message": "Video not found."
}
```

**500 Internal Server Error** - Database update failed
```json
{
    "status": "INTERNAL_SERVER_ERROR",
    "message": "Failed to update video status."
}
```

## What the Endpoint Does

1. **Validates Input**: Checks that videoId is provided
2. **Finds Video**: Looks up the video in the database
3. **Updates Video Status**: Changes status from "processing" to "ready"
4. **Updates Upload Record**: Changes upload status from "pending" to "completed"
5. **Cleans Up Temporary Files**: Removes the temporary upload folder (`uploads/tmp/uploadId`)
6. **Updates Transcoding Jobs**: Marks all transcoding jobs for this video as completed
7. **Returns Success**: Provides confirmation of all updates

## Database Changes

### Videos Table
- `status`: "processing" → "ready"
- `updated_at`: Set to current timestamp

### Uploads Table  
- `status`: "pending" → "completed"
- `completed_at`: Set to current timestamp

### Transcoding Jobs Table
- `status`: "queued"/"processing" → "completed"
- `progress`: Set to 100
- `completed_at`: Set to current timestamp

## File System Changes

### Temporary Upload Folder
- **Action**: Deletes `uploads/tmp/{uploadId}` folder
- **Purpose**: Free up disk space after processing is complete
- **Safety**: Uses `force: true` to handle missing folders gracefully
- **Logging**: Logs cleanup success or warnings for failures

## Usage Example (Server B)

```javascript
// When processing is complete on Server B
const axios = require('axios');

async function notifyVideoReady(videoId) {
    try {
        const response = await axios.post('http://main-server:3000/videometadata/service/video-ready-to-serve', {
            videoId: videoId
        });
        
        console.log('✅ Video marked as ready:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Failed to notify video ready:', error.response?.data || error.message);
        throw error;
    }
}

// Usage
await notifyVideoReady(123);
```

## Testing

Use the provided test script:
```bash
node test_video_ready_endpoint.js
```

Make sure to:
1. Start your server on port 3000
2. Replace the videoId in the test with an actual video ID
3. Run the test script

## Security Notes

- This endpoint is part of the service endpoints (backend-to-backend)
- No authentication middleware is applied (internal service communication)
- Consider adding API key validation for production use
- Monitor this endpoint for potential abuse 