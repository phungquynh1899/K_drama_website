# Chunk Upload Behavior

## Overview
The upload system now stores chunks separately without merging them into a single file. This is designed for a distributed architecture where:

1. **Old PC**: Acts as temporary chunk storage
2. **Powerful Laptop**: Handles merging, transcoding, and processing

## Current Flow

### 1. Chunk Upload
- Files are split into 64MB chunks
- Each chunk is uploaded to `/api/v1/upload/chunk`
- Chunks are stored in `public/uploads/tmp/{uploadId}/chunk_{index}`

### 2. Upload Completion
- When all chunks are uploaded, `/api/v1/upload/complete` is called
- System verifies all chunks are present
- **No merging occurs** - chunks remain separate
- Returns upload status with chunk directory information

### 3. Chunk Information
- Use `/api/v1/upload/chunks/{uploadId}` to get chunk details
- Returns information about all chunks including sizes and paths

## API Endpoints

### POST `/api/v1/upload/chunk`
Uploads a single chunk.

**Request:**
```json
{
  "uploadId": "upload_1234567890_abc123",
  "chunkIndex": 0,
  "totalChunks": 5,
  "chunk": [binary data]
}
```

**Response:**
```json
{
  "message": "Chunk uploaded",
  "chunkIndex": 0
}
```

### POST `/api/v1/upload/complete`
Verifies all chunks are present and marks upload as complete.

**Request:**
```json
{
  "uploadId": "upload_1234567890_abc123",
  "totalChunks": 5,
  "filename": "video.mp4"
}
```

**Response:**
```json
{
  "message": "Upload complete - all chunks received",
  "uploadId": "upload_1234567890_abc123",
  "totalChunks": 5,
  "chunkDirectory": "/path/to/chunks",
  "status": "chunks_ready"
}
```

### GET `/api/v1/upload/chunks/{uploadId}`
Get detailed information about chunks for an upload.

**Response:**
```json
{
  "uploadId": "upload_1234567890_abc123",
  "chunkDirectory": "/path/to/chunks",
  "totalChunks": 5,
  "totalSize": 320000000,
  "chunks": [
    {
      "index": 0,
      "path": "/path/to/chunks/chunk_0",
      "size": 67108864,
      "sizeMB": "64.00"
    }
  ]
}
```

## File Structure
```
public/uploads/tmp/
├── upload_1234567890_abc123/
│   ├── chunk_0
│   ├── chunk_1
│   ├── chunk_2
│   ├── chunk_3
│   └── chunk_4
└── upload_9876543210_def456/
    ├── chunk_0
    └── chunk_1
```

## Benefits for Distributed Architecture

1. **Memory Efficient**: No large file merging on the old PC
2. **Network Efficient**: Chunks can be transferred individually to processing machine
3. **Resumable**: Individual chunks can be retried without re-uploading everything
4. **Parallel Processing**: Different chunks can be processed simultaneously
5. **Storage Flexibility**: Chunks can be moved to different storage locations

## Future Integration

The chunks can later be merged on a more powerful machine using the existing `mergeChunks` function in the upload service, or processed individually for transcoding, virus scanning, etc. 