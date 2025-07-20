# Technology Stack Selection: K-Drama Streaming Website

## **Decision Framework**

### **1. Requirements Analysis**
- **Performance:** 3-second video start time, 20-30 concurrent streams
- **Scalability:** 50-100 concurrent users target
- **Hardware:** 4GB RAM per machine, limited CPU (G2020, i5-8250U)
- **Storage:** 160GB SSDs, need efficient caching
- **Network:** Single IP address, home internet bandwidth
- **Budget:** Free tier services, minimal costs

### **2. Technology Evaluation Matrix**

## **Backend Language Selection**

### **Node.js vs Python vs Go**

| Criteria | Node.js | Python | Go |
|----------|---------|--------|-----|
| **Memory Efficiency** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **CPU Performance** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Async I/O** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Video Processing** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Ecosystem** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Learning Curve** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **4GB RAM Fit** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

### **Recommendation: Node.js**

**Why Node.js is the right choice for your system:**

1. **Memory Efficiency:** Event-driven, non-blocking I/O uses less memory per connection
2. **Async Upload Handling:** Perfect for chunked uploads and streaming
3. **Rich Ecosystem:** Excellent libraries for video streaming, file handling, and APIs
4. **Single-threaded:** Simpler to reason about on your limited hardware
5. **JSON Native:** Perfect for API interfaces and metadata handling

**Specific Benefits for Your Use Case:**
- **Streaming:** Built-in streaming support with `fs.createReadStream()`
- **Chunked Uploads:** Excellent support with `multer` and `busboy`
- **Memory Management:** Automatic garbage collection, good for 4GB RAM
- **Real-time Features:** WebSocket support for upload progress

## **Frontend Framework Selection**

### **React vs Vue vs Vanilla JS**

| Criteria | React | Vue | Vanilla JS |
|----------|-------|-----|------------|
| **Bundle Size** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Video Player** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Upload UI** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **Learning Curve** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Performance** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Mobile Support** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

### **Recommendation: React**

**Why React for your K-drama website:**

1. **Video Player Integration:** Excellent libraries like `react-player`, `video.js`
2. **Upload Progress:** Great state management for chunked uploads
3. **Component Reusability:** Perfect for series/episode listings
4. **Mobile Responsive:** Easy to make responsive for mobile users
5. **Large Ecosystem:** Many video and upload-related components

## **Database Selection**

### **SQLite vs PostgreSQL vs MongoDB**

| Criteria | SQLite | PostgreSQL | MongoDB |
|----------|--------|------------|---------|
| **Memory Usage** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Setup Complexity** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Query Performance** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Metadata Storage** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **4GB RAM Fit** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Backup/Recovery** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

### **Recommendation: SQLite**

**Why SQLite for your mini data center:**

1. **Zero Configuration:** No server setup, just a file
2. **Memory Efficient:** Minimal memory footprint
3. **Reliable:** ACID compliance, crash-safe
4. **Perfect for Metadata:** Excellent for video metadata, user data
5. **Backup Simple:** Just copy the file
6. **Node.js Integration:** Excellent with `sqlite3` or `better-sqlite3`

## **Caching Strategy**

### **Redis vs In-Memory vs File-based**

| Criteria | Redis | In-Memory | File-based |
|----------|-------|-----------|------------|
| **Memory Usage** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Persistence** | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Setup Complexity** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **4GB RAM Fit** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

### **Recommendation: Hybrid Approach**

**Your Architecture:**
- **Metadata Cache:** Redis (2GB allocation)
- **Video Cache:** File-based on SSD (50GB)
- **Session Cache:** In-memory (Node.js)

## **Video Processing Stack**

### **FFmpeg vs HandBrake vs Cloud Services**

| Criteria | FFmpeg | HandBrake | Google Cloud |
|----------|--------|-----------|--------------|
| **CPU Usage** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Quality** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Cost** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Reliability** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Setup** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |

### **Recommendation: FFmpeg + Google Cloud**

**Strategy:**
- **Primary:** Google Cloud Transcoder API (free tier)
- **Fallback:** FFmpeg on laptops
- **Queue Management:** Node.js job queue

## **Load Balancer Selection**

### **Nginx vs HAProxy vs Node.js**

| Criteria | Nginx | HAProxy | Node.js |
|----------|-------|---------|---------|
| **Memory Usage** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Configuration** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Static Files** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **SSL/TLS** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Rate Limiting** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

### **Recommendation: Nginx**

**Why Nginx for your old PC:**
1. **Static File Serving:** Excellent for frontend files
2. **Reverse Proxy:** Perfect for routing to your services
3. **Rate Limiting:** Built-in protection against abuse
4. **SSL Termination:** Handle HTTPS certificates
5. **Low Memory:** Efficient for your 4GB RAM constraint

## **Complete Technology Stack**

### **Backend Stack**
```javascript
// Core Technologies
{
  "runtime": "Node.js 18.x LTS",
  "framework": "Express.js",
  "database": "SQLite3",
  "cache": {
    "metadata": "Redis 6.x",
    "sessions": "Node.js memory",
    "videos": "File system (SSD)"
  },
  "video": {
    "transcoding": "FFmpeg + Google Cloud API",
    "streaming": "HLS.js",
    "upload": "Multer + custom chunking"
  },
  "authentication": "JWT + bcrypt",
  "loadBalancer": "Nginx",
  "monitoring": "Winston + custom metrics"
}
```

### **Frontend Stack**
```javascript
// Frontend Technologies
{
  "framework": "React 18",
  "buildTool": "Vite",
  "videoPlayer": "Video.js or Plyr",
  "uploadUI": "Resumable.js",
  "stateManagement": "React Context + useReducer",
  "styling": "Tailwind CSS",
  "bundling": "Vite (fast builds, small bundles)"
}
```

### **Infrastructure Stack**
```javascript
// Infrastructure
{
  "cdn": "Cloudflare (free tier)",
  "storage": {
    "primary": "Wasabi S3",
    "backup": "iDrive",
    "local": "SSD cache"
  },
  "transcoding": "Google Cloud Transcoder API",
  "monitoring": "Custom Node.js metrics",
  "ssl": "Let's Encrypt (free)"
}
```

## **Implementation Priority**

### **Phase 1: Core Infrastructure (Week 1-2)**
1. **Load Balancer Setup:** Nginx configuration
2. **Basic Backend:** Node.js + Express + SQLite
3. **Authentication:** JWT implementation
4. **Basic Frontend:** React + video player

### **Phase 2: Upload System (Week 3-4)**
1. **Chunked Upload:** Multer + custom chunking
2. **File Validation:** Video format checking
3. **Progress Tracking:** Real-time upload progress
4. **Error Handling:** Resume capability

### **Phase 3: Video Processing (Week 5-6)**
1. **Transcoding Pipeline:** FFmpeg integration
2. **Google Cloud Integration:** API setup
3. **Job Queue:** Background processing
4. **Quality Management:** Multiple resolutions

### **Phase 4: Streaming & Caching (Week 7-8)**
1. **HLS Streaming:** Video.js integration
2. **Caching Layer:** Redis + SSD cache
3. **CDN Integration:** Cloudflare setup
4. **Performance Optimization:** Monitoring

## **Why This Stack Works for Your Constraints**

### **Memory Efficiency (4GB RAM)**
- **Node.js:** Event-driven, low memory per connection
- **SQLite:** No database server, just file I/O
- **Redis:** Configurable memory limits
- **Nginx:** Efficient static file serving

### **CPU Limitations (G2020, i5-8250U)**
- **Async I/O:** Node.js handles many connections with minimal CPU
- **FFmpeg:** Efficient video processing
- **Google Cloud:** Offloads heavy transcoding
- **Queue System:** Prevents CPU overload

### **Storage Constraints (160GB SSDs)**
- **SQLite:** Minimal storage overhead
- **Smart Caching:** LRU eviction for video segments
- **Cloud Storage:** Primary storage offloaded
- **Compression:** Efficient video formats

### **Network Limitations (Single IP)**
- **Nginx:** Efficient reverse proxy
- **CDN:** Cloudflare handles global distribution
- **Chunked Uploads:** Reliable large file uploads
- **Caching:** Reduces bandwidth usage

## **Risk Mitigation**

### **Technology Risks**
1. **Node.js Memory Leaks:** Use heap snapshots, monitor memory
2. **SQLite Locking:** Implement proper connection pooling
3. **FFmpeg Failures:** Robust error handling and retries
4. **Google Cloud Limits:** Fallback to local processing

### **Hardware Risks**
1. **4GB RAM Limit:** Monitor memory usage, implement limits
2. **CPU Bottleneck:** Queue transcoding jobs
3. **SSD Space:** Implement automatic cleanup
4. **Network Issues:** Graceful degradation

## **Future Scalability**

### **When You Outgrow This Stack**
1. **Database:** SQLite → PostgreSQL (when you need concurrent writes)
2. **Caching:** Redis → Redis Cluster (when you need more memory)
3. **Load Balancer:** Nginx → HAProxy (when you need advanced routing)
4. **Video Processing:** Local → Cloud-only (when you have budget)

### **Migration Strategy**
- **Gradual Migration:** Keep existing system running
- **Feature Flags:** Roll out new features gradually
- **Data Migration:** Scripts to move data between systems
- **Monitoring:** Track performance during migration

## **Summary**

**Node.js is the right choice because:**
1. **Memory Efficient:** Perfect for your 4GB RAM constraint
2. **Async I/O:** Handles many concurrent connections
3. **Video Streaming:** Excellent libraries and native streaming
4. **Ecosystem:** Rich libraries for your specific needs
5. **Learning Curve:** You're already familiar, reducing risk

**This stack balances:**
- **Performance:** Meets your 3-second video start requirement
- **Scalability:** Can grow to 50-100 concurrent users
- **Reliability:** Handles your hardware constraints gracefully
- **Cost:** Minimal expenses, mostly free tier services
- **Maintainability:** Simple to understand and debug

The key is choosing technologies that work well within your constraints while providing room for growth. Node.js + SQLite + Nginx gives you a solid foundation that can scale with your needs. 