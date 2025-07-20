# Architecture Documentation: K-Drama Streaming Website

---

## **1. Component Diagram**

This diagram shows the high-level components and their relationships in your system, with all requests unified through the Load Balancer.

```mermaid
graph TB
    %% External Users and Services
    User[👤 User]
    CDN[🌐 Cloudflare CDN]
    GoogleCloud[☁️ Google Cloud]
    Wasabi[💾 Wasabi Storage]
    iDrive[💾 iDrive Storage]
    
    %% Mini Data Center Components
    subgraph "Mini Data Center"
        subgraph "Old PC (Load Balancer + Auth + Cache)"
            LB[Load Balancer<br/>+ Rate Limiting<br/>+ Authentication<br/>+ CORS<br/>+ DDoS Protection]
            Auth[Authentication Service]
            Redis[Redis Cache<br/>Metadata]
            SSDCache[SSD Cache<br/>Video Segments]
        end
        
        subgraph "Laptop 1"
            Upload1[Upload Service]
            Transcode1[Transcoding Service]
            Stream1[Streaming Service]
        end
        
        subgraph "Laptop 2"
            Upload2[Upload Service]
            Transcode2[Transcoding Service]
            Stream2[Streaming Service]
            Metadata[Video Metadata Service]
        end
    end
    
    %% Frontend (served as static files)
    Frontend[🖥️ Frontend Website<br/>Static Files]
    
    %% All requests unified through Load Balancer
    User --> CDN
    CDN --> LB
    Frontend --> CDN
    CDN --> LB
    
    %% Load Balancer routes everything
    LB --> Auth
    LB --> Upload1
    LB --> Upload2
    LB --> Stream1
    LB --> Stream2
    LB --> Metadata
    LB --> Frontend
    
    %% Backend service connections
    Upload1 --> Transcode1
    Upload2 --> Transcode2
    
    Transcode1 --> GoogleCloud
    Transcode2 --> GoogleCloud
    GoogleCloud --> Wasabi
    GoogleCloud --> iDrive
    
    Stream1 --> Metadata
    Stream2 --> Metadata
    Metadata --> Redis
    Metadata --> SSDCache
    
    SSDCache --> Wasabi
    SSDCache --> iDrive
    
    %% Styling
    classDef external fill:#e1f5fe
    classDef core fill:#f3e5f5
    classDef storage fill:#e8f5e8
    classDef cache fill:#fff3e0
    
    class User,CDN,GoogleCloud,Wasabi,iDrive external
    class LB,Auth,Upload1,Upload2,Transcode1,Transcode2,Stream1,Stream2,Metadata,Frontend core
    class Redis,SSDCache storage
    class Wasabi,iDrive cache
```

---

## **2. Upload Flow Sequence Diagram**

This diagram shows the detailed flow of video uploads, with all requests going through the Load Balancer.

```mermaid
sequenceDiagram
    participant U as User
    participant CDN as Cloudflare CDN
    participant LB as Load Balancer
    participant Auth as Auth Service
    participant Upload as Upload Service
    participant Chunk as Chunk Manager
    participant Transcode as Transcoding Service
    participant GC as Google Cloud
    participant Local as Local Transcoding
    participant Storage as Storage (Wasabi/iDrive)
    participant Cache as Cache Layer
    
    Note over U,Storage: Upload Flow with Unified Request Handling
    
    U->>CDN: 1. Start Upload Session
    CDN->>LB: 2. Forward Request
    LB->>Auth: 3. Validate JWT Token
    Auth-->>LB: 4. Token Valid
    LB->>Upload: 5. Route to Upload Service
    
    Note over U,Storage: Chunked Upload Process
    loop For Each Chunk
        U->>CDN: 6a. Upload Chunk (5MB)
        CDN->>LB: 6b. Forward Chunk
        LB->>Upload: 6c. Route Chunk
        Upload->>Chunk: 6d. Store Chunk
        Chunk-->>Upload: 6e. Chunk Stored + Checksum
        Upload-->>LB: 6f. Chunk Confirmed
        LB-->>CDN: 6g. Forward Confirmation
        CDN-->>U: 6h. Chunk Confirmed
    end
    
    Upload->>Chunk: 7. All Chunks Received
    Chunk->>Chunk: 8. Combine Chunks into Full Video
    Chunk->>Chunk: 9. Verify Final Checksum
    Chunk-->>Upload: 10. Video Ready for Transcoding
    
    Note over U,Storage: Transcoding with Fallback Logic
    Upload->>Transcode: 11. Start Transcoding Job
    
    alt Google Cloud Available (90% of jobs)
        Transcode->>GC: 12a. Send to Google Cloud
        GC->>GC: 13a. Transcode Video
        GC->>Storage: 14a. Store Transcoded Files
        GC-->>Transcode: 15a. Transcoding Complete
    else Google Cloud Unavailable (10% of jobs)
        Transcode->>Local: 12b. Send to Local Transcoding
        Local->>Local: 13b. Transcode Video
        Local->>Storage: 14b. Store Transcoded Files
        Local-->>Transcode: 15b. Transcoding Complete
    end
    
    Transcode->>Cache: 16. Update Cache
    Transcode-->>Upload: 17. Job Complete
    Upload-->>LB: 18. Upload Success
    LB-->>CDN: 19. Forward Success
    CDN-->>U: 20. Upload Success Notification
```

---

## **3. Streaming Flow Sequence Diagram**

This diagram shows how video streaming works with unified request handling through the Load Balancer.

```mermaid
sequenceDiagram
    participant U as User
    participant CDN as Cloudflare CDN
    participant LB as Load Balancer
    participant Auth as Auth Service
    participant Stream as Streaming Service
    participant Metadata as Metadata Service
    participant Redis as Redis Cache
    participant SSDCache as SSD Cache
    participant Storage as Storage (Wasabi/iDrive)
    
    Note over U,Storage: Streaming Flow with Unified Request Handling
    
    U->>CDN: 1. Request Video Stream
    CDN->>LB: 2. Forward Request
    LB->>Auth: 3. Validate Access
    Auth-->>LB: 4. Access Granted
    LB->>Stream: 5. Route to Streaming Service
    
    Stream->>Metadata: 6. Get Video Metadata
    Metadata->>Redis: 7. Check Metadata Cache
    
    alt Metadata Cache Hit
        Redis-->>Metadata: 8a. Return Cached Metadata
    else Metadata Cache Miss
        Metadata->>Storage: 8b. Fetch from Storage
        Storage-->>Metadata: 9b. Return Metadata
        Metadata->>Redis: 10b. Cache Metadata
    end
    
    Metadata-->>Stream: 11. Return Video Info
    
    Stream->>SSDCache: 12. Check Video Segment Cache
    
    alt Video Cache Hit
        SSDCache-->>Stream: 13a. Return Cached Video
        Stream->>LB: 14a. Serve from Cache
    else Video Cache Miss
        Stream->>Storage: 13b. Fetch Video Segment
        Storage-->>Stream: 14b. Return Video Segment
        Stream->>SSDCache: 15b. Cache Video Segment
        Stream->>LB: 16b. Serve Video
    end
    
    LB-->>CDN: 17. Forward Video Stream
    CDN-->>U: 18. Stream Video to User
    
    Note over U,Storage: Adaptive Bitrate Streaming
    loop For Each Video Segment
        U->>CDN: 19. Request Next Segment
        CDN->>LB: 20. Forward Request
        LB->>Stream: 21. Get Segment
        Stream->>SSDCache: 22. Check Cache
        alt Cache Hit
            SSDCache-->>Stream: 23a. Return Segment
        else Cache Miss
            Stream->>Storage: 23b. Fetch Segment
            Storage-->>Stream: 24b. Return Segment
            Stream->>SSDCache: 25b. Cache Segment
        end
        Stream-->>LB: 26. Return Segment
        LB-->>CDN: 27. Forward Segment
        CDN-->>U: 28. Stream Segment
    end
```

---

## **4. Deployment Diagram**

This diagram shows the physical deployment with unified request handling through the Load Balancer.

```mermaid
graph TB
    %% Internet/External
    Internet[🌐 Internet]
    
    %% Cloudflare CDN
    CDN[🌐 Cloudflare CDN<br/>Global Edge Servers]
    
    %% Google Cloud
    GoogleCloud[☁️ Google Cloud<br/>Free Tier]
    
    %% External Storage
    Wasabi[💾 Wasabi Storage<br/>3 Copies]
    iDrive[💾 iDrive Storage<br/>3 Copies]
    
    %% Mini Data Center
    subgraph "Mini Data Center - Home Network"
        subgraph "Old PC (G2020, 4GB RAM, 160GB SSD)"
            PC_LB[Load Balancer<br/>Nginx/HAProxy<br/>+ Rate Limiting<br/>+ Authentication<br/>+ CORS<br/>+ DDoS Protection]
            PC_Auth[Authentication Service<br/>Node.js/Python]
            PC_Redis[Redis Cache<br/>2GB Memory]
            PC_SSD[SSD Cache<br/>50GB Video Segments]
            PC_Frontend[Frontend Files<br/>HTML/CSS/JS]
        end
        
        subgraph "Laptop 1 (i5-8250U, 4GB RAM, 160GB SSD)"
            L1_Upload[Upload Service<br/>Chunk Handler]
            L1_Transcode[Transcoding Service<br/>FFmpeg]
            L1_Stream[Streaming Service<br/>HLS/DASH]
        end
        
        subgraph "Laptop 2 (i5-8250U, 4GB RAM, 160GB SSD)"
            L2_Upload[Upload Service<br/>Chunk Handler]
            L2_Transcode[Transcoding Service<br/>FFmpeg]
            L2_Stream[Streaming Service<br/>HLS/DASH]
            L2_Metadata[Metadata Service<br/>Database]
        end
    end
    
    %% Network Connections - All through Load Balancer
    Internet --> CDN
    CDN --> PC_LB
    
    %% Load Balancer routes everything
    PC_LB --> PC_Auth
    PC_LB --> PC_Frontend
    PC_LB --> L1_Upload
    PC_LB --> L1_Stream
    PC_LB --> L2_Upload
    PC_LB --> L2_Stream
    PC_LB --> L2_Metadata
    
    %% Backend service connections
    L1_Upload --> L1_Transcode
    L2_Upload --> L2_Transcode
    
    L1_Transcode --> GoogleCloud
    L2_Transcode --> GoogleCloud
    
    GoogleCloud --> Wasabi
    GoogleCloud --> iDrive
    
    L2_Metadata --> PC_Redis
    L2_Metadata --> PC_SSD
    
    L1_Stream --> L2_Metadata
    L2_Stream --> L2_Metadata
    
    PC_SSD --> Wasabi
    PC_SSD --> iDrive
    
    %% Styling
    classDef external fill:#e1f5fe
    classDef core fill:#f3e5f5
    classDef storage fill:#e8f5e8
    classDef cache fill:#fff3e0
    
    class Internet,CDN,GoogleCloud,Wasabi,iDrive external
    class PC_LB,PC_Auth,PC_Frontend,L1_Upload,L1_Transcode,L1_Stream,L2_Upload,L2_Transcode,L2_Stream,L2_Metadata core
    class PC_Redis,PC_SSD storage
    class Wasabi,iDrive cache
```

---

## **5. System Architecture Summary**

### **Key Design Principles:**
1. **Unified Request Handling:** All requests (page loads and API calls) go through the Load Balancer
2. **Centralized Security:** Load Balancer handles authentication, rate limiting, CORS, and DDoS protection
3. **Redundancy:** Multiple copies of data across different storage providers
4. **Fallback:** Automatic switching between Google Cloud and local processing
5. **Caching:** Multi-layer caching (Redis for metadata, SSD for video segments)

### **Data Flow Patterns:**
- **All Requests:** User/Frontend → CDN → Load Balancer → Backend Services
- **Upload:** Load Balancer → Upload Service → Chunk Manager → Transcoding → Storage
- **Streaming:** Load Balancer → Streaming Service → Metadata Service → Cache/Storage
- **Caching:** Redis (metadata) + SSD (video segments) with automatic eviction

### **Security Implementation:**
- **Load Balancer:** Rate limiting, JWT validation, CORS, DDoS protection
- **Authentication:** Centralized in Load Balancer, validated for all API requests
- **Input Validation:** Sanitized at Load Balancer level before reaching services

### **Failure Handling:**
- **Google Cloud Down:** Automatic fallback to local transcoding
- **Single Machine Failure:** System continues with remaining machines
- **Storage Failure:** Multiple copies ensure data availability
- **Network Issues:** Local services continue, sync when network returns

---

## **6. Technology Stack Recommendations**

### **Load Balancer (Old PC):**
- **Software:** Nginx or HAProxy
- **Security:** Rate limiting, JWT validation, CORS, DDoS protection
- **Static Files:** Serve frontend HTML/CSS/JS

### **Backend Services:**
- **Authentication:** Node.js/Express or Python/Flask with JWT
- **Upload Service:** Node.js with multer or Python with Flask-Uploads
- **Transcoding:** FFmpeg (local) + Google Cloud Transcoder API
- **Streaming:** Node.js with HLS.js or Python with Flask-Video

### **Caching & Storage:**
- **Metadata Cache:** Redis (2GB on Old PC)
- **Video Cache:** File system on SSD (50GB on Old PC)
- **Primary Storage:** Wasabi S3 API
- **Backup Storage:** iDrive API

### **Frontend:**
- **Framework:** React, Vue.js, or vanilla JavaScript
- **Video Player:** Video.js or Plyr
- **Upload UI:** Resumable.js or custom chunked upload

### **Monitoring:**
- **System Health:** Prometheus + Grafana
- **Logging:** Winston (Node.js) or Logging (Python)
- **Error Tracking:** Sentry or custom error logging

---

## **7. Load Balancer Configuration Example**

### **Nginx Configuration:**
```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=upload:10m rate=2r/s;

server {
    listen 80;
    server_name yourwebsite.com;
    
    # Static files (frontend)
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
    }
    
    # API routes with unified security
    location /api/ {
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
        
        # CORS
        add_header 'Access-Control-Allow-Origin' 'https://yourwebsite.com';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type';
        
        # JWT validation
        auth_request /auth/validate;
        
        # Route to backend services
        location /api/auth {
            proxy_pass http://auth-service:3001;
        }
        
        location /api/videos {
            proxy_pass http://video-service:3002;
        }
        
        location /api/upload {
            limit_req zone=upload burst=5 nodelay;
            proxy_pass http://upload-service:3003;
        }
        
        location /api/stream {
            proxy_pass http://streaming-service:3004;
        }
    }
    
    # Authentication validation endpoint
    location /auth/validate {
        internal;
        proxy_pass http://auth-service:3001/validate;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-Original-URI $request_uri;
    }
}
```

---

This updated architecture documentation reflects the unified approach where all requests go through the Load Balancer, providing a simpler, more maintainable system that's perfect for your K-drama streaming website. 