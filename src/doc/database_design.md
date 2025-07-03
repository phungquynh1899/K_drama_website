# Database Design for K-Drama Streaming Website

## Overview
This document defines the database schema for a K-drama streaming website with video upload, transcoding, and user management capabilities.

## Technology Stack
- **Database**: SQLite (initial), PostgreSQL (when scaling)
- **Location**: Old PC (centralized)
- **Backup**: Local + Cloud (Wasabi/iDrive)

---

## Core Tables

### 1. users
Stores users and admin accounts. Normal users (Facebook plugin) are not stored here.

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'useruser') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);
```

**Fields:**
- `id`: Primary key
- `username`: Unique username for login
- `email`: Unique email address
- `password_hash`: Bcrypt hashed password
- `role`: User role (admin or useruser)
- `is_active`: Account status
- `created_at`: Account creation timestamp
- `updated_at`: Last update timestamp
- `last_login_at`: Last login timestamp

---

### 2. videos
Stores video metadata and basic information.

```sql
CREATE TABLE videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    year INTEGER,
    genre VARCHAR(100),
    actors TEXT, -- JSON array of actor names
    duration_seconds INTEGER,
    original_filename VARCHAR(255),
    uploader_user_id INTEGER NOT NULL,
    status ENUM('uploading', 'processing', 'ready', 'failed') DEFAULT 'uploading',
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploader_user_id) REFERENCES users(id)
);
```

**Fields:**
- `id`: Primary key
- `title`: Video title
- `description`: Video description
- `year`: Release year
- `genre`: Video genre
- `actors`: JSON array of actor names
- `duration_seconds`: Video duration in seconds
- `original_filename`: Original uploaded filename
- `uploader_user_id`: Foreign key to users table
- `status`: Current video status
- `is_public`: Whether video is publicly accessible
- `created_at`: Video creation timestamp
- `updated_at`: Last update timestamp

---

### 3. api_keys
Stores API keys for VIP users to upload videos.

```sql
CREATE TABLE api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Fields:**
- `id`: Primary key
- `user_id`: Foreign key to users table
- `api_key`: The actual API key (hashed)
- `is_active`: Whether the key is active
- `created_at`: Key creation timestamp
- `expires_at`: Key expiration timestamp (optional)
- `last_used_at`: Last usage timestamp

---

### 4. keys
Stores public/private key pairs for JWT signing, associated with each user.

```sql
CREATE TABLE keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id)
);
```

**Fields:**
- `id`: Primary key
- `user_id`: Foreign key to users table (unique, one key pair per user)
- `public_key`: Public key for JWT verification
- `private_key`: Private key for JWT signing (encrypted)
- `is_active`: Whether the key pair is active
- `created_at`: Key pair creation timestamp
- `expires_at`: Key pair expiration timestamp

---

## Upload & Processing Tables

### 5. uploads
Tracks video upload sessions.

```sql
CREATE TABLE uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    video_id INTEGER, -- NULL until upload completes
    filename VARCHAR(255) NOT NULL,
    total_size BIGINT NOT NULL,
    total_chunks INTEGER NOT NULL,
    uploaded_chunks TEXT, -- JSON array of completed chunk numbers
    status ENUM('pending', 'uploading', 'completed', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (video_id) REFERENCES videos(id)
);
```

**Fields:**
- `id`: Primary key
- `user_id`: Foreign key to users table
- `video_id`: Foreign key to videos table (created after upload)
- `filename`: Original filename
- `total_size`: Total file size in bytes
- `total_chunks`: Total number of chunks
- `uploaded_chunks`: JSON array of completed chunk numbers
- `status`: Upload status
- `created_at`: Upload start timestamp
- `completed_at`: Upload completion timestamp

---

### 6. upload_chunks
Tracks individual chunk uploads.

```sql
CREATE TABLE upload_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id INTEGER NOT NULL,
    chunk_number INTEGER NOT NULL,
    chunk_size INTEGER NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    status ENUM('pending', 'uploaded', 'verified', 'failed') DEFAULT 'pending',
    uploaded_at TIMESTAMP,
    verified_at TIMESTAMP,
    FOREIGN KEY (upload_id) REFERENCES uploads(id),
    UNIQUE(upload_id, chunk_number)
);
```

**Fields:**
- `id`: Primary key
- `upload_id`: Foreign key to uploads table
- `chunk_number`: Sequential chunk number
- `chunk_size`: Size of this chunk in bytes
- `checksum`: SHA-256 checksum of the chunk
- `status`: Chunk status
- `uploaded_at`: Upload timestamp
- `verified_at`: Verification timestamp

---

### 7. transcoding_jobs
Tracks video transcoding jobs.

```sql
CREATE TABLE transcoding_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    status ENUM('queued', 'processing', 'completed', 'failed') DEFAULT 'queued',
    provider ENUM('google_cloud', 'local_server') DEFAULT 'google_cloud',
    priority INTEGER DEFAULT 5, -- 1=highest, 10=lowest
    input_format VARCHAR(20),
    output_formats TEXT, -- JSON array of target formats
    job_id VARCHAR(255), -- External job ID (Google Cloud, etc.)
    progress INTEGER DEFAULT 0, -- 0-100
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id)
);
```

**Fields:**
- `id`: Primary key
- `video_id`: Foreign key to videos table
- `status`: Job status
- `provider`: Transcoding provider
- `priority`: Job priority (1=highest, 10=lowest)
- `input_format`: Input video format
- `output_formats`: JSON array of target formats (720p, 1080p, etc.)
- `job_id`: External job identifier
- `progress`: Progress percentage (0-100)
- `error_message`: Error details if failed
- `created_at`: Job creation timestamp
- `started_at`: Processing start timestamp
- `completed_at`: Processing completion timestamp

---

### 8. video_files
Stores information about video files (original and transcoded versions).

```sql
CREATE TABLE video_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    file_type ENUM('original', 'transcoded_720p', 'transcoded_1080p', 'thumbnail') NOT NULL,
    storage_provider ENUM('wasabi', 'idrive', 'local', 'google_cloud') NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    mime_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id)
);
```

**Fields:**
- `id`: Primary key
- `video_id`: Foreign key to videos table
- `file_type`: Type of video file
- `storage_provider`: Where the file is stored
- `file_path`: Path/URL to the file
- `file_size`: File size in bytes
- `checksum`: SHA-256 checksum
- `mime_type`: MIME type of the file
- `created_at`: File creation timestamp

---

## Relationships

### One-to-Many Relationships:
- **users** → **videos** (one user can upload many videos)
- **users** → **api_keys** (one user can have multiple API keys)
- **users** → **uploads** (one user can have multiple uploads)
- **videos** → **transcoding_jobs** (one video can have multiple transcoding jobs, ex: with the same video, one job for 720p, one job for 1080p or a retry job if the first failed or maybe latter when we want to add 4k support)
- **videos** → **video_files** (one video can have multiple file versions)
- **uploads** → **upload_chunks** (one upload has multiple chunks)

### Foreign Key Constraints:
- All foreign keys have proper constraints
- Cascade deletes where appropriate
- Unique constraints on business-critical fields

---

## Indexes

### Performance Indexes:
```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Videos
CREATE INDEX idx_videos_uploader ON videos(uploader_user_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_created ON videos(created_at);

-- API Keys
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_key ON api_keys(api_key);

-- Uploads
CREATE INDEX idx_uploads_user ON uploads(user_id);
CREATE INDEX idx_uploads_status ON uploads(status);

-- Upload Chunks
CREATE INDEX idx_upload_chunks_upload ON upload_chunks(upload_id);
CREATE INDEX idx_upload_chunks_status ON upload_chunks(status);

-- Transcoding Jobs
CREATE INDEX idx_transcoding_jobs_video ON transcoding_jobs(video_id);
CREATE INDEX idx_transcoding_jobs_status ON transcoding_jobs(status);
CREATE INDEX idx_transcoding_jobs_priority ON transcoding_jobs(priority);

-- Video Files
CREATE INDEX idx_video_files_video ON video_files(video_id);
CREATE INDEX idx_video_files_type ON video_files(file_type);
```

---

## Implementation Notes

### 1. SQLite vs PostgreSQL
- **Start with SQLite** for simplicity and low resource usage
- **Migrate to PostgreSQL** when you need:
  - Multiple concurrent writers
  - Advanced JSON operations
  - Better performance with large datasets

### 2. Data Types
- **SQLite**: Uses TEXT for JSON fields, INTEGER for timestamps
- **PostgreSQL**: Use JSONB for JSON fields, TIMESTAMP for timestamps

### 3. Security Considerations
- Hash passwords with bcrypt
- Hash API keys before storing
- Encrypt private keys
- Use prepared statements to prevent SQL injection

### 4. Backup Strategy
- **Local backups**: Daily SQLite file copies
- **Cloud backups**: Weekly encrypted backups to Wasabi/iDrive
- **Retention**: Keep 30 days of local backups, 1 year of cloud backups

### 5. Scaling Considerations
- **Read replicas**: For high read loads
- **Sharding**: By user_id for very large scale
- **Caching**: Redis for frequently accessed data
- **CDN**: Cloudflare for video file delivery

---

## Optional Future Tables

### 9. user_sessions (for refresh tokens)
```sql
CREATE TABLE user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 10. video_analytics (for tracking views)
```sql
CREATE TABLE video_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    user_id INTEGER, -- NULL for anonymous
    ip_address VARCHAR(45),
    user_agent TEXT,
    watch_duration INTEGER, -- seconds
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 11. comments (if storing locally)
```sql
CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    user_id INTEGER, -- NULL for anonymous
    facebook_comment_id VARCHAR(255), -- if syncing with Facebook
    content TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## Repository Interface Design

### Base Repository Pattern:
```javascript
// Base repository interface
class BaseRepository {
    async findById(id) { throw new Error('Not implemented'); }
    async create(data) { throw new Error('Not implemented'); }
    async update(id, data) { throw new Error('Not implemented'); }
    async delete(id) { throw new Error('Not implemented'); }
}

// Specific repositories
class VideoRepository extends BaseRepository {
    async findByUploader(userId) { /* implementation */ }
    async findByStatus(status) { /* implementation */ }
}

class UserRepository extends BaseRepository {
    async findByEmail(email) { /* implementation */ }
    async findByUsername(username) { /* implementation */ }
}

class ApiKeyRepository extends BaseRepository {
    async findByKey(apiKey) { /* implementation */ }
    async findByUser(userId) { /* implementation */ }
}
```

This design provides a solid foundation for your K-drama streaming website with room for future growth and scaling. 