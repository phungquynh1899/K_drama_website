# API Interfaces & Data Contracts: K-Drama Streaming Website

---

## **1. What Are Interfaces and Why They Matter**

### **Definition:**
An **interface** is a contract that defines:
- **What data** services exchange
- **How** services communicate (HTTP methods, endpoints)
- **When** services should respond
- **What errors** can occur and how to handle them

### **Benefits:**
- **Consistency:** All services follow the same patterns
- **Reliability:** Services know exactly what to expect
- **Maintainability:** Changes are isolated and predictable
- **Testing:** Easy to test each service independently

---

## **2. Interface Design Principles**

### **RESTful Design:**
- Use HTTP methods correctly (GET, POST, PUT, DELETE)
- Use meaningful URLs (`/api/videos/123` not `/api/getVideo?id=123`)
- Return appropriate HTTP status codes
- Use consistent response formats

### **Data Contracts:**
- Define exact data structures (JSON schemas)
- Specify required vs optional fields
- Document data types and validation rules
- Version your APIs for backward compatibility

---

## **3. Core Service Interfaces**

## **3.1 Load Balancer → Authentication Service Interface**

### **Purpose:** Validate JWT tokens for all API requests

### **Interface Contract:**

```typescript
// Request from Load Balancer to Auth Service
interface AuthValidationRequest {
  method: 'POST'
  url: '/auth/validate'
  headers: {
    'Authorization': 'Bearer <jwt_token>'
    'X-Original-URI': string  // Original request path
  }
  body: null  // No body needed for validation
}

// Response from Auth Service to Load Balancer
interface AuthValidationResponse {
  status: 200 | 401 | 403
  headers: {
    'X-User-ID': string      // User ID if valid
    'X-User-Role': string    // 'user' | 'uploader' | 'admin'
    'X-User-Permissions': string  // Comma-separated permissions
  }
  body: {
    valid: boolean
    user?: {
      id: string
      username: string
      role: string
      permissions: string[]
    }
    error?: string
  }
}
```

### **Example Implementation:**

```javascript
// Load Balancer (Nginx) configuration
location /auth/validate {
    internal;
    proxy_pass http://auth-service:3001/validate;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header X-Original-URI $request_uri;
    proxy_set_header Authorization $http_authorization;
}

// Auth Service endpoint
app.post('/validate', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const originalUri = req.headers['x-original-uri'];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    res.status(200).json({
      valid: true,
      user: {
        id: decoded.userId,
        username: decoded.username,
        role: decoded.role,
        permissions: decoded.permissions
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

---

## **3.2 Upload Service Interface**

### **Purpose:** Handle chunked video uploads

### **Interface Contract:**

```typescript
// 1. Start Upload Session
interface StartUploadRequest {
  method: 'POST'
  url: '/api/upload/start'
  headers: {
    'Authorization': 'Bearer <jwt_token>'
    'Content-Type': 'application/json'
  }
  body: {
    filename: string
    totalSize: number
    chunkSize: number  // Usually 5MB
    metadata: {
      title: string
      series: string
      episode: number
      description?: string
      language: string
      subtitles?: string[]
    }
  }
}

interface StartUploadResponse {
  status: 200 | 400 | 401 | 413
  body: {
    uploadId: string
    chunkUrls: string[]  // URLs for each chunk
    expiresAt: string    // ISO timestamp
    checksums: string[]  // Expected checksums for each chunk
  }
}

// 2. Upload Chunk
interface UploadChunkRequest {
  method: 'POST'
  url: '/api/upload/chunk/:uploadId/:chunkIndex'
  headers: {
    'Authorization': 'Bearer <jwt_token>'
    'Content-Type': 'multipart/form-data'
    'X-Chunk-Checksum': string  // MD5/SHA256 of chunk
  }
  body: FormData {
    chunk: File  // Binary chunk data
  }
}

interface UploadChunkResponse {
  status: 200 | 400 | 401 | 404
  body: {
    chunkIndex: number
    received: boolean
    checksum: string
    missingChunks?: number[]  // If chunks are out of order
    nextExpectedChunk?: number
  }
}

// 3. Complete Upload
interface CompleteUploadRequest {
  method: 'POST'
  url: '/api/upload/complete/:uploadId'
  headers: {
    'Authorization': 'Bearer <jwt_token>'
    'Content-Type': 'application/json'
  }
  body: {
    finalChecksum: string  // Checksum of reassembled file
  }
}

interface CompleteUploadResponse {
  status: 200 | 400 | 401 | 404
  body: {
    uploadId: string
    videoId: string
    status: 'processing' | 'failed'
    transcodingJobId?: string
    estimatedCompletion?: string
  }
}
```

### **Example Implementation:**

```javascript
// Upload Service - Start Upload
app.post('/api/upload/start', authenticateToken, async (req, res) => {
  const { filename, totalSize, chunkSize, metadata } = req.body;
  const userId = req.user.id;
  
  // Validate file size (max 2GB)
  if (totalSize > 2 * 1024 * 1024 * 1024) {
    return res.status(413).json({ error: 'File too large' });
  }
  
  // Create upload session
  const uploadId = generateUploadId();
  const numChunks = Math.ceil(totalSize / chunkSize);
  const chunkUrls = [];
  const checksums = [];
  
  for (let i = 0; i < numChunks; i++) {
    chunkUrls.push(`/api/upload/chunk/${uploadId}/${i}`);
    checksums.push(''); // Will be calculated when chunks arrive
  }
  
  // Store in database
  await db.uploads.create({
    uploadId,
    userId,
    filename,
    totalSize,
    chunkSize,
    metadata,
    status: 'uploading',
    createdAt: new Date()
  });
  
  res.json({
    uploadId,
    chunkUrls,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    checksums
  });
});

// Upload Service - Upload Chunk
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
  
  // Check for missing chunks (out of order)
  const receivedChunks = await getReceivedChunks(uploadId);
  const totalChunks = await getTotalChunks(uploadId);
  const missingChunks = [];
  
  for (let i = 0; i < totalChunks; i++) {
    if (!receivedChunks.includes(i)) {
      missingChunks.push(i);
    }
  }
  
  res.json({
    chunkIndex: parseInt(chunkIndex),
    received: true,
    checksum: actualChecksum,
    missingChunks: missingChunks.length > 0 ? missingChunks : undefined,
    nextExpectedChunk: missingChunks.length > 0 ? missingChunks[0] : undefined
  });
});
```

---

## **3.3 Transcoding Service Interface**

### **Purpose:** Convert videos to streaming formats

### **Interface Contract:**

```typescript
// 1. Start Transcoding Job
interface StartTranscodingRequest {
  method: 'POST'
  url: '/api/transcode/start'
  headers: {
    'Authorization': 'Bearer <service_token>'
    'Content-Type': 'application/json'
  }
  body: {
    videoId: string
    sourcePath: string
    outputFormats: {
      hls: {
        resolutions: ['360p', '720p', '1080p']
        segmentDuration: number  // seconds
      }
      dash?: {
        resolutions: ['360p', '720p', '1080p']
        segmentDuration: number
      }
    }
    priority: 'high' | 'normal' | 'low'
    callbackUrl?: string  // Webhook for completion
  }
}

interface StartTranscodingResponse {
  status: 200 | 400 | 500
  body: {
    jobId: string
    status: 'queued' | 'processing' | 'failed'
    estimatedDuration: number  // minutes
    provider: 'google_cloud' | 'local'
  }
}

// 2. Get Job Status
interface GetJobStatusRequest {
  method: 'GET'
  url: '/api/transcode/status/:jobId'
  headers: {
    'Authorization': 'Bearer <service_token>'
  }
}

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
      dash?: {
        manifest: string
        segments: string[]
      }
    }
    error?: string
    completedAt?: string
  }
}
```

### **Example Implementation:**

```javascript
// Transcoding Service - Start Job
app.post('/api/transcode/start', authenticateServiceToken, async (req, res) => {
  const { videoId, sourcePath, outputFormats, priority, callbackUrl } = req.body;
  
  try {
    // Try Google Cloud first
    const googleCloudAvailable = await checkGoogleCloudAvailability();
    
    let jobId, provider;
    
    if (googleCloudAvailable) {
      // Use Google Cloud Transcoder
      const job = await googleCloudTranscoder.createJob({
        inputUri: sourcePath,
        output: {
          uri: `gs://your-bucket/transcoded/${videoId}/`,
          format: 'HLS',
          resolutions: outputFormats.hls.resolutions
        }
      });
      
      jobId = job.id;
      provider = 'google_cloud';
    } else {
      // Use local transcoding
      jobId = await startLocalTranscoding(videoId, sourcePath, outputFormats);
      provider = 'local';
    }
    
    // Store job in database
    await db.transcodingJobs.create({
      jobId,
      videoId,
      provider,
      status: 'queued',
      priority,
      callbackUrl,
      createdAt: new Date()
    });
    
    res.json({
      jobId,
      status: 'queued',
      estimatedDuration: provider === 'google_cloud' ? 15 : 45,
      provider
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to start transcoding' });
  }
});

// Transcoding Service - Get Status
app.get('/api/transcode/status/:jobId', authenticateServiceToken, async (req, res) => {
  const { jobId } = req.params;
  
  const job = await db.transcodingJobs.findByPk(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  let outputFiles;
  if (job.status === 'completed') {
    outputFiles = {
      hls: {
        playlist: `/videos/${job.videoId}/playlist.m3u8`,
        segments: await getVideoSegments(job.videoId)
      }
    };
  }
  
  res.json({
    jobId,
    status: job.status,
    progress: job.progress || 0,
    outputFiles,
    error: job.error,
    completedAt: job.completedAt
  });
});
```

---

## **3.4 Streaming Service Interface**

### **Purpose:** Serve video streams to users

### **Interface Contract:**

```typescript
// 1. Get Video Stream
interface GetVideoStreamRequest {
  method: 'GET'
  url: '/api/stream/:videoId'
  headers: {
    'Authorization': 'Bearer <jwt_token>'
    'Range'?: string  // For partial content requests
  }
  query: {
    quality?: '360p' | '720p' | '1080p'
    format?: 'hls' | 'dash'
  }
}

interface GetVideoStreamResponse {
  status: 200 | 206 | 401 | 404
  headers: {
    'Content-Type': 'video/mp4' | 'application/vnd.apple.mpegurl'
    'Content-Length'?: string
    'Content-Range'?: string
    'Accept-Ranges': 'bytes'
    'Cache-Control': 'public, max-age=3600'
  }
  body: Buffer | string  // Video data or HLS playlist
}

// 2. Get Video Metadata
interface GetVideoMetadataRequest {
  method: 'GET'
  url: '/api/videos/:videoId'
  headers: {
    'Authorization': 'Bearer <jwt_token>'
  }
}

interface GetVideoMetadataResponse {
  status: 200 | 401 | 404
  body: {
    id: string
    title: string
    series: string
    episode: number
    description: string
    duration: number  // seconds
    fileSize: number  // bytes
    availableQualities: string[]
    thumbnailUrl: string
    uploadDate: string
    uploader: {
      id: string
      username: string
    }
    streamingUrls: {
      hls: string
      dash?: string
    }
  }
}
```

### **Example Implementation:**

```javascript
// Streaming Service - Get Video Stream
app.get('/api/stream/:videoId', authenticateToken, async (req, res) => {
  const { videoId } = req.params;
  const { quality = '720p', format = 'hls' } = req.query;
  const range = req.headers.range;
  
  try {
    // Get video metadata
    const video = await getVideoMetadata(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // Check user permissions
    if (!canUserAccessVideo(req.user, video)) {
      return res.status(401).json({ error: 'Access denied' });
    }
    
    // Check cache first
    const cachedVideo = await checkVideoCache(videoId, quality);
    if (cachedVideo) {
      return serveCachedVideo(res, cachedVideo, range);
    }
    
    // Fetch from storage
    const videoPath = await getVideoPath(videoId, quality);
    const videoStream = await fetchFromStorage(videoPath);
    
    // Cache the video
    await cacheVideo(videoId, quality, videoStream);
    
    // Serve video with proper headers
    const fileSize = videoStream.length;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=3600'
      });
      
      videoStream.slice(start, end + 1).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600'
      });
      
      videoStream.pipe(res);
    }
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to stream video' });
  }
});
```

---

## **3.5 Metadata Service Interface**

### **Purpose:** Store and retrieve video metadata

### **Interface Contract:**

```typescript
// 1. Create Video Metadata
interface CreateVideoMetadataRequest {
  method: 'POST'
  url: '/api/metadata/videos'
  headers: {
    'Authorization': 'Bearer <service_token>'
    'Content-Type': 'application/json'
  }
  body: {
    videoId: string
    title: string
    series: string
    episode: number
    description: string
    duration: number
    fileSize: number
    uploaderId: string
    uploaderUsername: string
    availableQualities: string[]
    thumbnailUrl: string
    streamingUrls: {
      hls: string
      dash?: string
    }
    tags?: string[]
    language: string
    subtitles?: string[]
  }
}

// 2. Search Videos
interface SearchVideosRequest {
  method: 'GET'
  url: '/api/metadata/videos/search'
  headers: {
    'Authorization': 'Bearer <jwt_token>'
  }
  query: {
    q?: string  // Search query
    series?: string
    episode?: number
    language?: string
    uploader?: string
    tags?: string
    page?: number
    limit?: number
    sort?: 'title' | 'uploadDate' | 'episode' | 'series'
    order?: 'asc' | 'desc'
  }
}

interface SearchVideosResponse {
  status: 200
  body: {
    videos: VideoMetadata[]
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// 3. Get Series Information
interface GetSeriesRequest {
  method: 'GET'
  url: '/api/metadata/series/:seriesName'
  headers: {
    'Authorization': 'Bearer <jwt_token>'
  }
}

interface GetSeriesResponse {
  status: 200 | 404
  body: {
    name: string
    description: string
    totalEpisodes: number
    availableEpisodes: number[]
    language: string
    tags: string[]
    thumbnailUrl: string
    episodes: VideoMetadata[]
  }
}
```

---

## **4. Error Handling Standards**

### **Standard Error Response Format:**

```typescript
interface ErrorResponse {
  status: 400 | 401 | 403 | 404 | 429 | 500
  body: {
    error: {
      code: string
      message: string
      details?: any
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
  'UPLOAD_FILE_TOO_LARGE': 'File size exceeds maximum allowed',
  'UPLOAD_INVALID_FORMAT': 'File format not supported',
  'UPLOAD_CHUNK_MISSING': 'Required chunk not found',
  'UPLOAD_CHECKSUM_MISMATCH': 'File integrity check failed',
  
  // Transcoding
  'TRANSCODE_JOB_NOT_FOUND': 'Transcoding job not found',
  'TRANSCODE_FAILED': 'Video transcoding failed',
  'TRANSCODE_PROVIDER_UNAVAILABLE': 'No transcoding provider available',
  
  // Streaming
  'STREAM_VIDEO_NOT_FOUND': 'Video not found',
  'STREAM_ACCESS_DENIED': 'User cannot access this video',
  'STREAM_QUALITY_NOT_AVAILABLE': 'Requested quality not available',
  
  // Rate Limiting
  'RATE_LIMIT_EXCEEDED': 'Too many requests, please try again later',
  
  // System
  'SYSTEM_UNAVAILABLE': 'Service temporarily unavailable',
  'SYSTEM_MAINTENANCE': 'System under maintenance'
};
```

### **Example Error Handling:**

```javascript
// Global error handler
app.use((error, req, res, next) => {
  const requestId = req.headers['x-request-id'] || generateRequestId();
  
  console.error(`[${requestId}] Error:`, error);
  
  const errorResponse = {
    error: {
      code: error.code || 'SYSTEM_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      requestId
    }
  };
  
  res.status(error.status || 500).json(errorResponse);
});

// Rate limiting middleware
const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Upload limit exceeded. Please try again later.',
      timestamp: new Date().toISOString()
    }
  }
});

app.use('/api/upload', uploadLimiter);
```

---

## **5. API Versioning Strategy**

### **URL Versioning:**

```typescript
// Version 1 API
/api/v1/videos/:id
/api/v1/upload/start
/api/v1/stream/:videoId

// Version 2 API (when needed)
/api/v2/videos/:id
/api/v2/upload/start
/api/v2/stream/:videoId
```

### **Header Versioning:**

```typescript
// Request with version header
headers: {
  'Authorization': 'Bearer <token>',
  'Accept-Version': 'v1',
  'Content-Type': 'application/json'
}
```

### **Version Compatibility:**

```javascript
// Support multiple versions
app.use('/api/v1', v1Routes);
app.use('/api/v2', v2Routes);

// Default to latest version
app.use('/api', v2Routes);
```

---

## **6. Testing Your Interfaces**

### **Unit Tests for Interfaces:**

```javascript
// Test upload interface
describe('Upload Service Interface', () => {
  test('should start upload session with valid data', async () => {
    const response = await request(app)
      .post('/api/upload/start')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        filename: 'episode1.mp4',
        totalSize: 1500000000,
        chunkSize: 5242880,
        metadata: {
          title: 'Episode 1',
          series: 'Test Drama',
          episode: 1,
          description: 'Test episode'
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

### **Integration Tests:**

```javascript
// Test complete upload flow
describe('Upload Integration Flow', () => {
  test('should complete full upload process', async () => {
    // 1. Start upload
    const startResponse = await startUpload(validToken, testVideoData);
    const { uploadId, chunkUrls } = startResponse.body;
    
    // 2. Upload chunks
    for (let i = 0; i < chunkUrls.length; i++) {
      const chunk = generateTestChunk(5 * 1024 * 1024); // 5MB
      const checksum = calculateChecksum(chunk);
      
      await uploadChunk(uploadId, i, chunk, checksum, validToken);
    }
    
    // 3. Complete upload
    const completeResponse = await completeUpload(uploadId, finalChecksum, validToken);
    
    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.status).toBe('processing');
    expect(completeResponse.body).toHaveProperty('transcodingJobId');
  });
});
```

---

## **7. Documentation Best Practices**

### **OpenAPI/Swagger Specification:**

```yaml
openapi: 3.0.0
info:
  title: K-Drama Streaming API
  version: 1.0.0
  description: API for uploading and streaming K-drama videos

paths:
  /api/upload/start:
    post:
      summary: Start a new upload session
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/StartUploadRequest'
      responses:
        '200':
          description: Upload session created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/StartUploadResponse'
        '413':
          description: File too large
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

components:
  schemas:
    StartUploadRequest:
      type: object
      required: [filename, totalSize, chunkSize, metadata]
      properties:
        filename:
          type: string
          description: Original filename
        totalSize:
          type: integer
          description: Total file size in bytes
          maximum: 2147483648
        chunkSize:
          type: integer
          description: Size of each chunk in bytes
          default: 5242880
        metadata:
          $ref: '#/components/schemas/VideoMetadata'

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

---

## **8. Monitoring and Observability**

### **Request Logging:**

```javascript
// Log all API requests
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    console.log({
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id
    });
  });
  
  next();
});
```

### **Performance Metrics:**

```javascript
// Track API performance
const prometheus = require('prom-client');

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  
  next();
});
```

---

## **Summary**

Defining clear interfaces between services is crucial for:

1. **Reliability:** Services know exactly what to expect from each other
2. **Maintainability:** Changes are isolated and predictable
3. **Testing:** Easy to test each service independently
4. **Documentation:** Clear contracts for developers
5. **Monitoring:** Track performance and errors consistently

Your K-drama streaming system benefits from these interfaces because:
- **Load Balancer** can route requests correctly
- **Upload Service** knows exactly what data to expect
- **Transcoding Service** gets clear job specifications
- **Streaming Service** can serve videos efficiently
- **Metadata Service** provides consistent data structures

Start with the core interfaces (authentication, upload, streaming) and expand as your system grows. Always version your APIs and maintain backward compatibility when possible. 