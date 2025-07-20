# Implementation Guide: Setting Up Your Technology Stack

## **Quick Start: Your Complete Setup**

### **1. Project Structure**
```
k-drama-website/
├── backend/
│   ├── services/
│   │   ├── auth/
│   │   ├── upload/
│   │   ├── transcoding/
│   │   ├── streaming/
│   │   └── metadata/
│   ├── config/
│   ├── database/
│   └── utils/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── hooks/
│   └── public/
├── nginx/
├── scripts/
└── docs/
```

## **2. Backend Setup (Node.js + Express)**

### **Package.json for Backend**
```json
{
  "name": "k-drama-backend",
  "version": "1.0.0",
  "description": "K-Drama Streaming Website Backend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest",
    "migrate": "node scripts/migrate.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "sqlite3": "^5.1.6",
    "better-sqlite3": "^8.6.0",
    "redis": "^4.6.7",
    "multer": "^1.4.5-lts.1",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.8.1",
    "winston": "^3.9.0",
    "fluent-ffmpeg": "^2.1.2",
    "aws-sdk": "^2.1409.0",
    "google-cloud-transcoder": "^2.2.0",
    "ws": "^8.13.0",
    "uuid": "^9.0.0",
    "crypto": "^1.0.1"
  },
  "devDependencies": {
    "nodemon": "^2.0.22",
    "jest": "^29.5.0",
    "supertest": "^6.3.3"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### **Server Setup (server.js)**
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

// Import services
const authRoutes = require('./services/auth/routes');
const uploadRoutes = require('./services/upload/routes');
const streamingRoutes = require('./services/streaming/routes');
const metadataRoutes = require('./services/metadata/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stream', streamingRoutes);
app.use('/api/videos', metadataRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  logger.info(`Server started on port ${PORT}`);
});
```

### **Database Setup (SQLite)**
```javascript
// database/connection.js
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/kdrama.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    series TEXT NOT NULL,
    episode INTEGER NOT NULL,
    description TEXT,
    duration INTEGER,
    file_size INTEGER,
    uploader_id TEXT,
    status TEXT DEFAULT 'processing',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploader_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    video_id TEXT,
    user_id TEXT,
    filename TEXT NOT NULL,
    total_size INTEGER NOT NULL,
    chunk_size INTEGER NOT NULL,
    status TEXT DEFAULT 'uploading',
    chunks_received TEXT, -- JSON array of received chunk indices
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS transcoding_jobs (
    id TEXT PRIMARY KEY,
    video_id TEXT,
    status TEXT DEFAULT 'queued',
    provider TEXT,
    progress INTEGER DEFAULT 0,
    output_files TEXT, -- JSON object
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (video_id) REFERENCES videos (id)
  );

  CREATE INDEX IF NOT EXISTS idx_videos_series ON videos(series);
  CREATE INDEX IF NOT EXISTS idx_videos_uploader ON videos(uploader_id);
  CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id);
  CREATE INDEX IF NOT EXISTS idx_transcoding_video ON transcoding_jobs(video_id);
`);

module.exports = db;
```

### **Redis Cache Setup**
```javascript
// cache/redis.js
const redis = require('redis');
const logger = require('../utils/logger');

const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  maxMemoryPolicy: 'allkeys-lru',
  maxMemory: '2gb' // Limit to 2GB for your 4GB RAM constraint
});

client.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

client.on('connect', () => {
  logger.info('Redis connected successfully');
});

// Cache utilities
const cache = {
  async get(key) {
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  },

  async set(key, value, ttl = 3600) {
    try {
      await client.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  },

  async del(key) {
    try {
      await client.del(key);
    } catch (error) {
      logger.error('Cache del error:', error);
    }
  }
};

module.exports = { client, cache };
```

## **3. Frontend Setup (React + Vite)**

### **Package.json for Frontend**
```json
{
  "name": "k-drama-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext js,jsx --report-unused-disable-directives --max-warnings 0"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.11.2",
    "video.js": "^7.21.4",
    "resumable.js": "^1.1.0",
    "axios": "^1.4.0",
    "react-query": "^3.39.3",
    "zustand": "^4.3.8"
  },
  "devDependencies": {
    "@types/react": "^18.2.15",
    "@types/react-dom": "^18.2.7",
    "@vitejs/plugin-react": "^4.0.3",
    "autoprefixer": "^10.4.14",
    "eslint": "^8.45.0",
    "eslint-plugin-react": "^7.32.2",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.3",
    "postcss": "^8.4.27",
    "tailwindcss": "^3.3.3",
    "vite": "^4.4.5"
  }
}
```

### **Vite Configuration**
```javascript
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          video: ['video.js'],
          upload: ['resumable.js']
        }
      }
    }
  }
})
```

### **Tailwind CSS Configuration**
```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef2f2',
          500: '#ef4444',
          900: '#7f1d1d',
        }
      }
    },
  },
  plugins: [],
}
```

## **4. Nginx Configuration**

### **Load Balancer Setup**
```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=2r/s;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;

        # Redirect HTTP to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        # SSL configuration
        ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Frontend (React app)
        location / {
            root /var/www/html;
            try_files $uri $uri/ /index.html;
            
            # Cache static assets
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }

        # API routes with unified security
        location /api/ {
            # Rate limiting
            limit_req zone=api burst=20 nodelay;
            
            # CORS
            add_header 'Access-Control-Allow-Origin' 'https://yourdomain.com' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
            
            # JWT validation
            auth_request /auth/validate;
            
            # Route to backend services
            location /api/auth {
                proxy_pass http://localhost:3000;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
            }
            
            location /api/videos {
                proxy_pass http://localhost:3000;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
            }
            
            location /api/upload {
                limit_req zone=upload burst=5 nodelay;
                client_max_body_size 2G;
                proxy_pass http://localhost:3000;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
                
                # Upload timeout
                proxy_read_timeout 300s;
                proxy_connect_timeout 75s;
            }
            
            location /api/stream {
                proxy_pass http://localhost:3000;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
                
                # Video streaming optimizations
                proxy_buffering off;
                proxy_cache_valid 200 1h;
                proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
            }
        }

        # Authentication validation endpoint
        location /auth/validate {
            internal;
            proxy_pass http://localhost:3000/api/auth/validate;
            proxy_pass_request_body off;
            proxy_set_header Content-Length "";
            proxy_set_header X-Original-URI $request_uri;
            proxy_set_header Authorization $http_authorization;
        }

        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

## **5. Environment Configuration**

### **Backend Environment (.env)**
```bash
# Server Configuration
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourdomain.com

# Database
DB_PATH=./data/kdrama.db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=12h
JWT_REFRESH_EXPIRES_IN=7d

# File Upload
UPLOAD_DIR=./uploads
CHUNK_SIZE=5242880
MAX_FILE_SIZE=2147483648

# Cloud Storage
WASABI_ACCESS_KEY=your_wasabi_access_key
WASABI_SECRET_KEY=your_wasabi_secret_key
WASABI_BUCKET=your-bucket-name
WASABI_REGION=us-east-1

IDRIVE_ACCESS_KEY=your_idrive_access_key
IDRIVE_SECRET_KEY=your_idrive_secret_key
IDRIVE_BUCKET=your-backup-bucket

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_CREDENTIALS_PATH=./google-credentials.json

# Monitoring
LOG_LEVEL=info
METRICS_PORT=9090
```

### **Frontend Environment (.env)**
```bash
VITE_API_URL=https://yourdomain.com/api
VITE_WS_URL=wss://yourdomain.com/ws
VITE_APP_NAME=K-Drama Streaming
```

## **6. Installation Scripts**

### **Setup Script (setup.sh)**
```bash
#!/bin/bash

echo "Setting up K-Drama Streaming Website..."

# Install Node.js dependencies
echo "Installing backend dependencies..."
cd backend
npm install

echo "Installing frontend dependencies..."
cd ../frontend
npm install

# Create necessary directories
echo "Creating directories..."
mkdir -p ../data
mkdir -p ../uploads
mkdir -p ../logs
mkdir -p ../cache/videos

# Set permissions
chmod 755 ../uploads
chmod 755 ../cache

# Install FFmpeg
echo "Installing FFmpeg..."
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sudo apt-get update
    sudo apt-get install -y ffmpeg
elif [[ "$OSTYPE" == "darwin"* ]]; then
    brew install ffmpeg
fi

# Install Redis
echo "Installing Redis..."
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sudo apt-get install -y redis-server
elif [[ "$OSTYPE" == "darwin"* ]]; then
    brew install redis
fi

# Start Redis
echo "Starting Redis..."
redis-server --daemonize yes

echo "Setup complete! Next steps:"
echo "1. Configure your .env files"
echo "2. Set up SSL certificates with Let's Encrypt"
echo "3. Configure Nginx"
echo "4. Start the services"
```

### **Start Services Script (start.sh)**
```bash
#!/bin/bash

echo "Starting K-Drama Streaming Services..."

# Start Redis if not running
if ! pgrep -x "redis-server" > /dev/null; then
    echo "Starting Redis..."
    redis-server --daemonize yes
fi

# Start backend
echo "Starting backend server..."
cd backend
npm start &

# Start frontend (development)
echo "Starting frontend development server..."
cd ../frontend
npm run dev &

# Wait for services to start
sleep 5

echo "Services started!"
echo "Backend: http://localhost:3000"
echo "Frontend: http://localhost:3001"
echo "Health check: http://localhost:3000/health"
```

## **7. Monitoring Setup**

### **Custom Metrics (monitoring/metrics.js)**
```javascript
const prometheus = require('prom-client');

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestsTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const uploadChunksTotal = new prometheus.Counter({
  name: 'upload_chunks_total',
  help: 'Total number of uploaded chunks',
  labelNames: ['upload_id', 'status']
});

const videoStreamsActive = new prometheus.Gauge({
  name: 'video_streams_active',
  help: 'Number of active video streams'
});

const transcodingJobsTotal = new prometheus.Counter({
  name: 'transcoding_jobs_total',
  help: 'Total number of transcoding jobs',
  labelNames: ['provider', 'status']
});

// Memory usage
const memoryUsage = new prometheus.Gauge({
  name: 'nodejs_memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type']
});

// Update memory metrics every 30 seconds
setInterval(() => {
  const mem = process.memoryUsage();
  memoryUsage.labels('rss').set(mem.rss);
  memoryUsage.labels('heapTotal').set(mem.heapTotal);
  memoryUsage.labels('heapUsed').set(mem.heapUsed);
  memoryUsage.labels('external').set(mem.external);
}, 30000);

module.exports = {
  httpRequestDuration,
  httpRequestsTotal,
  uploadChunksTotal,
  videoStreamsActive,
  transcodingJobsTotal,
  memoryUsage
};
```

## **8. Testing Setup**

### **Jest Configuration (jest.config.js)**
```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'services/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
```

### **Sample Test (tests/upload.test.js)**
```javascript
const request = require('supertest');
const app = require('../server');
const db = require('../database/connection');

describe('Upload Service', () => {
  beforeAll(async () => {
    // Setup test database
    db.exec('DELETE FROM uploads');
    db.exec('DELETE FROM videos');
  });

  test('should start upload session', async () => {
    const response = await request(app)
      .post('/api/upload/start')
      .set('Authorization', 'Bearer test-token')
      .send({
        filename: 'test-episode.mp4',
        totalSize: 1500000000,
        chunkSize: 5242880,
        metadata: {
          title: 'Test Episode',
          series: 'Test Drama',
          episode: 1
        }
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('uploadId');
    expect(response.body).toHaveProperty('chunkUrls');
  });

  test('should reject oversized files', async () => {
    const response = await request(app)
      .post('/api/upload/start')
      .set('Authorization', 'Bearer test-token')
      .send({
        filename: 'large-file.mp4',
        totalSize: 3000000000, // 3GB
        chunkSize: 5242880,
        metadata: {
          title: 'Large File',
          series: 'Test',
          episode: 1
        }
      });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('UPLOAD_FILE_TOO_LARGE');
  });
});
```

## **Summary**

This implementation guide provides:

1. **Complete Setup:** All necessary configuration files
2. **Production Ready:** Security, monitoring, and error handling
3. **Scalable:** Can grow with your needs
4. **Testable:** Includes testing setup
5. **Monitored:** Custom metrics and logging

**Next Steps:**
1. Run the setup script
2. Configure your environment variables
3. Set up SSL certificates
4. Start the services
5. Test the system

The stack is designed to work within your 4GB RAM constraints while providing excellent performance for your K-drama streaming website. 