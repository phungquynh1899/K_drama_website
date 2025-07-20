# Defining Interfaces: APIs and Data Contracts Between Services

## **What Are Interfaces?**

An **interface** is a contract that defines:
- **What data** services exchange
- **How** services communicate (HTTP methods, endpoints)
- **When** services should respond
- **What errors** can occur and how to handle them

## **Why Interfaces Matter for Your K-Drama Website**

Based on your architecture, you have multiple services that need to communicate:
- **Load Balancer** → **Authentication Service**
- **Upload Service** → **Transcoding Service**
- **Streaming Service** → **Metadata Service**
- **CDN** → **Load Balancer**

Clear interfaces ensure these services work together reliably.

## **1. Load Balancer → Authentication Service Interface**

### **Purpose:** Validate JWT tokens for all API requests

```typescript
// Request from Load Balancer to Auth Service
interface AuthValidationRequest {
  method: 'POST'
  url: '/auth/validate'
  headers: {
    'Authorization': 'Bearer <jwt_token>'
    'X-Original-URI': string  // Original request path
  }
}

// Response from Auth Service to Load Balancer
interface AuthValidationResponse {
  status: 200 | 401 | 403
  headers: {
    'X-User-ID': string
    'X-User-Role': string    // 'user' | 'uploader' | 'admin'
  }
  body: {
    valid: boolean
    user?: {
      id: string
      username: string
      role: string
    }
    error?: string
  }
}
```

### **Implementation Example:**

```javascript
// Auth Service endpoint
app.post('/validate', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    res.status(200).json({
      valid: true,
      user: {
        id: decoded.userId,
        username: decoded.username,
        role: decoded.role
      }
    });
  } catch (error) {
    res.status(401).json({
      valid: false,
      error: 'Invalid token'
    });
  }
});
```

## **2. Upload Service Interface**

### **Purpose:** Handle chunked video uploads

```typescript
// Start Upload Session
interface StartUploadRequest {
  method: 'POST'
  url: '/api/upload/start'
  body: {
    filename: string
    totalSize: number
    chunkSize: number  // Usually 5MB
    metadata: {
      title: string
      series: string
      episode: number
      description?: string
    }
  }
}

interface StartUploadResponse {
  status: 200 | 400 | 413
  body: {
    uploadId: string
    chunkUrls: string[]
    expiresAt: string
  }
}

// Upload Chunk
interface UploadChunkRequest {
  method: 'POST'
  url: '/api/upload/chunk/:uploadId/:chunkIndex'
  headers: {
    'X-Chunk-Checksum': string
  }
  body: FormData {
    chunk: File
  }
}

// Complete Upload
interface CompleteUploadRequest {
  method: 'POST'
  url: '/api/upload/complete/:uploadId'
  body: {
    finalChecksum: string
  }
}
```

## **3. Transcoding Service Interface**

### **Purpose:** Convert videos to streaming formats

```typescript
// Start Transcoding Job
interface StartTranscodingRequest {
  method: 'POST'
  url: '/api/transcode/start'
  body: {
    videoId: string
    sourcePath: string
    outputFormats: {
      hls: {
        resolutions: ['360p', '720p', '1080p']
        segmentDuration: number
      }
    }
    priority: 'high' | 'normal' | 'low'
  }
}

interface StartTranscodingResponse {
  status: 200 | 500
  body: {
    jobId: string
    status: 'queued' | 'processing' | 'failed'
    provider: 'google_cloud' | 'local'
  }
}

// Get Job Status
interface GetJobStatusResponse {
  status: 200 | 404
  body: {
    jobId: string
    status: 'queued' | 'processing' | 'completed' | 'failed'
    progress: number  // 0-100
    outputFiles?: {
      hls: {
        playlist: string
        segments: string[]
      }
    }
  }
}
```

## **4. Streaming Service Interface**

### **Purpose:** Serve video streams to users

```typescript
// Get Video Stream
interface GetVideoStreamRequest {
  method: 'GET'
  url: '/api/stream/:videoId'
  headers: {
    'Range'?: string  // For partial content requests
  }
  query: {
    quality?: '360p' | '720p' | '1080p'
  }
}

interface GetVideoStreamResponse {
  status: 200 | 206 | 404
  headers: {
    'Content-Type': 'video/mp4'
    'Content-Length'?: string
    'Content-Range'?: string
    'Accept-Ranges': 'bytes'
    'Cache-Control': 'public, max-age=3600'
  }
  body: Buffer  // Video data
}

// Get Video Metadata
interface GetVideoMetadataResponse {
  status: 200 | 404
  body: {
    id: string
    title: string
    series: string
    episode: number
    duration: number
    availableQualities: string[]
    streamingUrls: {
      hls: string
    }
  }
}
```

## **5. Error Handling Standards**

### **Standard Error Response Format:**

```typescript
interface ErrorResponse {
  status: 400 | 401 | 403 | 404 | 429 | 500
  body: {
    error: {
      code: string
      message: string
      timestamp: string
      requestId: string
    }
  }
}
```

### **Common Error Codes:**

```javascript
const ERROR_CODES = {
  // Authentication
  'AUTH_INVALID_TOKEN': 'Invalid or expired authentication token',
  'AUTH_INSUFFICIENT_PERMISSIONS': 'User lacks required permissions',
  
  // Upload
  'UPLOAD_FILE_TOO_LARGE': 'File size exceeds maximum allowed (2GB)',
  'UPLOAD_INVALID_FORMAT': 'File format not supported',
  'UPLOAD_CHUNK_MISSING': 'Required chunk not found',
  
  // Transcoding
  'TRANSCODE_JOB_NOT_FOUND': 'Transcoding job not found',
  'TRANSCODE_FAILED': 'Video transcoding failed',
  
  // Streaming
  'STREAM_VIDEO_NOT_FOUND': 'Video not found',
  'STREAM_ACCESS_DENIED': 'User cannot access this video',
  
  // Rate Limiting
  'RATE_LIMIT_EXCEEDED': 'Too many requests, please try again later'
};
```

## **6. Implementation Example: Upload Flow**

Here's how the interfaces work together in your upload flow:

```javascript
// 1. User starts upload
app.post('/api/upload/start', authenticateToken, async (req, res) => {
  const { filename, totalSize, chunkSize, metadata } = req.body;
  
  // Validate file size (max 2GB)
  if (totalSize > 2 * 1024 * 1024 * 1024) {
    return res.status(413).json({
      error: {
        code: 'UPLOAD_FILE_TOO_LARGE',
        message: 'File size exceeds maximum allowed (2GB)',
        timestamp: new Date().toISOString()
      }
    });
  }
  
  // Create upload session
  const uploadId = generateUploadId();
  const numChunks = Math.ceil(totalSize / chunkSize);
  const chunkUrls = [];
  
  for (let i = 0; i < numChunks; i++) {
    chunkUrls.push(`/api/upload/chunk/${uploadId}/${i}`);
  }
  
  res.json({
    uploadId,
    chunkUrls,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });
});

// 2. User uploads chunks
app.post('/api/upload/chunk/:uploadId/:chunkIndex', authenticateToken, async (req, res) => {
  const { uploadId, chunkIndex } = req.params;
  const chunk = req.files.chunk;
  const expectedChecksum = req.headers['x-chunk-checksum'];
  
  // Verify chunk integrity
  const actualChecksum = calculateChecksum(chunk.data);
  if (actualChecksum !== expectedChecksum) {
    return res.status(400).json({
      error: {
        code: 'UPLOAD_CHECKSUM_MISMATCH',
        message: 'Chunk integrity check failed',
        timestamp: new Date().toISOString()
      }
    });
  }
  
  // Store chunk
  await storeChunk(uploadId, parseInt(chunkIndex), chunk.data);
  
  res.json({
    chunkIndex: parseInt(chunkIndex),
    received: true,
    checksum: actualChecksum
  });
});

// 3. User completes upload
app.post('/api/upload/complete/:uploadId', authenticateToken, async (req, res) => {
  const { uploadId } = req.params;
  const { finalChecksum } = req.body;
  
  // Combine chunks and verify
  const videoPath = await combineChunks(uploadId);
  const actualChecksum = calculateChecksum(videoPath);
  
  if (actualChecksum !== finalChecksum) {
    return res.status(400).json({
      error: {
        code: 'UPLOAD_CHECKSUM_MISMATCH',
        message: 'Final file integrity check failed',
        timestamp: new Date().toISOString()
      }
    });
  }
  
  // Start transcoding
  const transcodingResponse = await fetch('/api/transcode/start', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SERVICE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      videoId: uploadId,
      sourcePath: videoPath,
      outputFormats: {
        hls: {
          resolutions: ['360p', '720p', '1080p'],
          segmentDuration: 10
        }
      },
      priority: 'normal'
    })
  });
  
  const transcodingJob = await transcodingResponse.json();
  
  res.json({
    uploadId,
    videoId: uploadId,
    status: 'processing',
    transcodingJobId: transcodingJob.jobId
  });
});
```

## **7. Testing Your Interfaces**

### **Unit Test Example:**

```javascript
describe('Upload Service Interface', () => {
  test('should start upload session with valid data', async () => {
    const response = await request(app)
      .post('/api/upload/start')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        filename: 'episode1.mp4',
        totalSize: 1500000000, // 1.5GB
        chunkSize: 5242880,    // 5MB
        metadata: {
          title: 'Episode 1',
          series: 'Test Drama',
          episode: 1
        }
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('uploadId');
    expect(response.body).toHaveProperty('chunkUrls');
    expect(response.body.chunkUrls).toHaveLength(287); // 1.5GB / 5MB
  });
  
  test('should reject oversized files', async () => {
    const response = await request(app)
      .post('/api/upload/start')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        filename: 'large.mp4',
        totalSize: 3000000000, // 3GB
        chunkSize: 5242880,
        metadata: { title: 'Large File', series: 'Test', episode: 1 }
      });
    
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('UPLOAD_FILE_TOO_LARGE');
  });
});
```

## **8. Best Practices**

### **1. Be Consistent**
- Use the same HTTP status codes across all services
- Follow the same error response format
- Use consistent naming conventions

### **2. Version Your APIs**
```typescript
// URL versioning
/api/v1/upload/start
/api/v2/upload/start

// Header versioning
headers: {
  'Accept-Version': 'v1'
}
```

### **3. Document Everything**
- Use OpenAPI/Swagger for API documentation
- Include examples for each endpoint
- Document all possible error codes

### **4. Monitor Performance**
```javascript
// Track API performance
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});
```

## **Summary**

For your K-drama streaming website, clear interfaces ensure:

1. **Load Balancer** routes requests correctly
2. **Upload Service** handles chunks reliably
3. **Transcoding Service** processes videos efficiently
4. **Streaming Service** serves content smoothly
5. **All services** communicate consistently

Start with the core interfaces (authentication, upload, streaming) and expand as your system grows. Always test your interfaces thoroughly and monitor their performance. 