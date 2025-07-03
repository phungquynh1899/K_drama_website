const DatabaseInterface = require('./DatabaseInterface');
const Database = require('better-sqlite3');


class BetterSqliteDatabase extends DatabaseInterface {
    static _instance = null;
    // nếu filename = 'mydbsqlite' thì constructor này chỉ tạo 1 database connection cho toàn bộ app
    // nếu filename != 'mydbsqlite' thì constructor này tạo 1 database mới
    // tức là  khi test mình gọi new Database(":memory:"), 1 database mới (khác với mydb.sqlite) được tạo ra trong RAM
    // việc tạo database mới này tạo điều kiện cho testing dễ hơn 
    // database mới  sau khi test sẽ được tự động dọn dẹp bởi jest và suppertest 
    // lần test thứ hai, mình vẫn gọi new Database(":memory:"), 1 database mới toanh (khác với mydb.sqlite, khác với databse được tạo ra từ lần test trước) được tạo ra trong RAM
    // nếu mình code cái kiểu chỉ cho phép 1 database được tạo ra duy nhất trong 1 app
    // mà không chừa đường nào để tester tự tạo 1 database mới 
    // thì mỗi lần test, bắt buộc test trên file 'mydb.sqlite'
    // mỗi lần create user (giả sử username = 'a') , dữ liệu được lưu vào file 'mydb sqlite'
    // lần test tiếp theo, mình phải tự đi xóa dữ liệu trong file 'mydb.sqlite' trước 
    // dù dữ liệu có thể không ảnh hưởng đến lần test sau 
    // nhưng rất nhiều lần test chay bằng postman, 
    // mình đã phải vào database xóa sạch bảng 
    // phiền
    
    constructor(filename = 'mydb.sqlite') {
        super();
        if(BetterSqliteDatabase._instance){
            throw new Error('Use BetterSqliteDatabase.getInstance() instead');
        }
        BetterSqliteDatabase._instance = this;
        this.db = new Database(filename);
        this._initTables();
    }

    static getInstance(filename = 'mydb.sqlite'){
        if(!BetterSqliteDatabase._instance){
            BetterSqliteDatabase._instance = new BetterSqliteDatabase(filename);
        }
        return BetterSqliteDatabase._instance;
    }

    _initTables() {
        // Users
        this.db.exec(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Videos
        this.db.exec(`CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            year INTEGER,
            genre TEXT,
            actors TEXT,
            duration_seconds INTEGER,
            original_filename TEXT NOT NULL,
            uploader_user_id INTEGER NOT NULL,
            status TEXT DEFAULT 'uploading',
            is_public INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (uploader_user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);
        
        // API Keys
        this.db.exec(`CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            api_key TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Keys (public/private)
        this.db.exec(`CREATE TABLE IF NOT EXISTS keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            public_key TEXT NOT NULL,
            private_key TEXT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id)
        )`);

        // Fix typo in uploads table and add missing tables
        this.db.exec(`CREATE TABLE IF NOT EXISTS uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            video_id INTEGER,
            filename VARCHAR(255) NOT NULL,
            total_size BIGINT NOT NULL,
            total_chunks INTEGER NOT NULL,
            uploaded_chunks TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (video_id) REFERENCES videos(id)
        )`);

        // Upload Chunks
        this.db.exec(`CREATE TABLE IF NOT EXISTS upload_chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            upload_id INTEGER NOT NULL,
            chunk_number INTEGER NOT NULL,
            chunk_size INTEGER NOT NULL,
            checksum VARCHAR(64) NOT NULL,
            status TEXT DEFAULT 'pending',
            uploaded_at TIMESTAMP,
            verified_at TIMESTAMP,
            FOREIGN KEY (upload_id) REFERENCES uploads(id),
            UNIQUE(upload_id, chunk_number)
        )`);

        // Transcoding Jobs
        this.db.exec(`CREATE TABLE IF NOT EXISTS transcoding_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER NOT NULL,
            status TEXT DEFAULT 'queued',
            provider TEXT DEFAULT 'google_cloud',
            priority INTEGER DEFAULT 5,
            input_format VARCHAR(20),
            output_formats TEXT,
            job_id VARCHAR(255),
            progress INTEGER DEFAULT 0,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            FOREIGN KEY (video_id) REFERENCES videos(id)
        )`);

        // Video Files
        this.db.exec(`CREATE TABLE IF NOT EXISTS video_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER NOT NULL,
            file_type TEXT NOT NULL,
            storage_provider TEXT NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_size BIGINT NOT NULL,
            checksum VARCHAR(64) NOT NULL,
            mime_type VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (video_id) REFERENCES videos(id)
        )`);

        // Optional: user_sessions
        this.db.exec(`CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            refresh_token VARCHAR(255) UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_used_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);
        // Optional: video_analytics
        this.db.exec(`CREATE TABLE IF NOT EXISTS video_analytics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER NOT NULL,
            user_id INTEGER,
            ip_address VARCHAR(45),
            user_agent TEXT,
            watch_duration INTEGER,
            viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (video_id) REFERENCES videos(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);
        // Optional: comments
        this.db.exec(`CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER NOT NULL,
            user_id INTEGER,
            facebook_comment_id VARCHAR(255),
            content TEXT NOT NULL,
            is_approved BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (video_id) REFERENCES videos(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);
    }

    // USERS
    async createUser(user) {
        const stmt = this.db.prepare(`INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)`);
        const result = stmt.run(user.username, user.email, user.password_hash, user.role || 'user', user.is_active ?? 1);
        return { id: result.lastInsertRowid, ...user };
    }
    async getUserById(id) {
        return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }
    async getUserByEmail(email) {
        return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    }
    async getUserByUsername(username) {
        return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    }
    async updateUser(id, updates) {
        const fields = [];
        const values = [];
        for (const key of ['username', 'email', 'password_hash', 'role', 'is_active']) {
            if (updates[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(updates[key]);
            }
        }
        if (fields.length === 0) return false;
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
        const result = this.db.prepare(sql).run(...values);
        return result.changes > 0;
    }
    async deleteUser(id) {
        const result = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
        return result.changes > 0;
    }

    // API KEYS
    async createApiKey(apiKey) {
        const stmt = this.db.prepare(`INSERT INTO api_keys (user_id, api_key, name, is_active) VALUES (?, ?, ?, ?)`);
        const result = stmt.run(apiKey.user_id, apiKey.api_key, apiKey.name, apiKey.is_active ?? 1);
        return { id: result.lastInsertRowid, ...apiKey };
    }
    async getApiKeyById(id) {
        return this.db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    }
    async getApiKeyByKey(apiKey) {
        return this.db.prepare('SELECT * FROM api_keys WHERE api_key = ? AND is_active = 1').get(apiKey);
    }
    async getApiKeysByUserId(userId) {
        return this.db.prepare('SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    }
    async deactivateApiKey(id) {
        const result = this.db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').run(id);
        return result.changes > 0;
    }
    async deleteApiKey(id) {
        const result = this.db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
        return result.changes > 0;
    }

    // KEYS (public/private)
    async createKeyPair(keyPair) { throw new Error('Not implemented'); }
    async getKeyPairByUserId(userId) { throw new Error('Not implemented'); }
    async deactivateKeyPair(id) { throw new Error('Not implemented'); }
    async deleteKeyPair(id) { throw new Error('Not implemented'); }

    // VIDEOS
    async createVideo(video) {
        const stmt = this.db.prepare(`INSERT INTO videos (title, description, year, genre, actors, duration_seconds, original_filename, uploader_user_id, status, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const result = stmt.run(
            video.title,
            video.description,
            video.year,
            video.genre,
            JSON.stringify(video.actors || []),
            video.duration_seconds,
            video.original_filename,
            video.uploader_user_id,
            video.status || 'uploading',
            video.is_public ?? 1
        );
        return { id: result.lastInsertRowid, ...video };
    }
    async getVideoById(id) {
        const row = this.db.prepare('SELECT * FROM videos WHERE id = ?').get(id);
        if (row && row.actors) row.actors = JSON.parse(row.actors);
        return row;
    }
    async getVideosByUserId(userId) {
        const rows = this.db.prepare('SELECT * FROM videos WHERE uploader_user_id = ? ORDER BY created_at DESC').all(userId);
        rows.forEach(row => { if (row.actors) row.actors = JSON.parse(row.actors); });
        return rows;
    }
    async updateVideo(id, updates) {
        const fields = [];
        const values = [];
        for (const key of ['title', 'description', 'year', 'genre', 'actors', 'duration_seconds', 'original_filename', 'status', 'is_public']) {
            if (updates[key] !== undefined) {
                if (key === 'actors') {
                    fields.push(`${key} = ?`);
                    values.push(JSON.stringify(updates[key]));
                } else {
                    fields.push(`${key} = ?`);
                    values.push(updates[key]);
                }
            }
        }
        if (fields.length === 0) return false;
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        const sql = `UPDATE videos SET ${fields.join(', ')} WHERE id = ?`;
        const result = this.db.prepare(sql).run(...values);
        return result.changes > 0;
    }
    async deleteVideo(id) {
        const result = this.db.prepare('DELETE FROM videos WHERE id = ?').run(id);
        return result.changes > 0;
    }
    async listVideos(filter = {}) {
        let sql = 'SELECT * FROM videos WHERE 1=1';
        const values = [];
        if (filter.status) {
            sql += ' AND status = ?';
            values.push(filter.status);
        }
        if (filter.is_public !== undefined) {
            sql += ' AND is_public = ?';
            values.push(filter.is_public ? 1 : 0);
        }
        if (filter.uploader_user_id) {
            sql += ' AND uploader_user_id = ?';
            values.push(filter.uploader_user_id);
        }
        sql += ' ORDER BY created_at DESC';
        if (filter.limit) {
            sql += ' LIMIT ?';
            values.push(filter.limit);
        }
        const rows = this.db.prepare(sql).all(...values);
        rows.forEach(row => { if (row.actors) row.actors = JSON.parse(row.actors); });
        return rows;
    }

    // UPLOADS
    async createUpload(upload) {
        const stmt = this.db.prepare(`INSERT INTO uploads (user_id, video_id, filename, total_size, total_chunks, uploaded_chunks, status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        const result = stmt.run(
            upload.user_id,
            upload.video_id || null,
            upload.filename,
            upload.total_size,
            upload.total_chunks,
            JSON.stringify(upload.uploaded_chunks || []),
            upload.status || 'pending'
        );
        return { id: result.lastInsertRowid, ...upload };
    }
    async getUploadById(id) {
        const row = this.db.prepare('SELECT * FROM uploads WHERE id = ?').get(id);
        if (row && row.uploaded_chunks) row.uploaded_chunks = JSON.parse(row.uploaded_chunks);
        return row;
    }
    async getUploadsByUserId(userId) {
        const rows = this.db.prepare('SELECT * FROM uploads WHERE user_id = ? ORDER BY created_at DESC').all(userId);
        rows.forEach(row => { if (row.uploaded_chunks) row.uploaded_chunks = JSON.parse(row.uploaded_chunks); });
        return rows;
    }
    async updateUpload(id, updates) {
        const fields = [];
        const values = [];
        for (const key of ['video_id', 'filename', 'total_size', 'total_chunks', 'uploaded_chunks', 'status', 'completed_at']) {
            if (updates[key] !== undefined) {
                if (key === 'uploaded_chunks') {
                    fields.push(`${key} = ?`);
                    values.push(JSON.stringify(updates[key]));
                } else {
                    fields.push(`${key} = ?`);
                    values.push(updates[key]);
                }
            }
        }
        if (fields.length === 0) return false;
        values.push(id);
        const sql = `UPDATE uploads SET ${fields.join(', ')} WHERE id = ?`;
        const result = this.db.prepare(sql).run(...values);
        return result.changes > 0;
    }
    async deleteUpload(id) {
        const result = this.db.prepare('DELETE FROM uploads WHERE id = ?').run(id);
        return result.changes > 0;
    }

    // UPLOAD CHUNKS
    async createUploadChunk(chunk) {
        const stmt = this.db.prepare(`INSERT INTO upload_chunks (upload_id, chunk_number, chunk_size, checksum, status, uploaded_at, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        const result = stmt.run(
            chunk.upload_id,
            chunk.chunk_number,
            chunk.chunk_size,
            chunk.checksum,
            chunk.status || 'pending',
            chunk.uploaded_at || null,
            chunk.verified_at || null
        );
        return { id: result.lastInsertRowid, ...chunk };
    }
    async getUploadChunk(uploadId, chunkNumber) {
        return this.db.prepare('SELECT * FROM upload_chunks WHERE upload_id = ? AND chunk_number = ?').get(uploadId, chunkNumber);
    }
    async updateUploadChunk(id, updates) {
        const fields = [];
        const values = [];
        for (const key of ['chunk_size', 'checksum', 'status', 'uploaded_at', 'verified_at']) {
            if (updates[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(updates[key]);
            }
        }
        if (fields.length === 0) return false;
        values.push(id);
        const sql = `UPDATE upload_chunks SET ${fields.join(', ')} WHERE id = ?`;
        const result = this.db.prepare(sql).run(...values);
        return result.changes > 0;
    }
    async listUploadChunks(uploadId) {
        return this.db.prepare('SELECT * FROM upload_chunks WHERE upload_id = ? ORDER BY chunk_number ASC').all(uploadId);
    }
    async deleteUploadChunk(id) {
        const result = this.db.prepare('DELETE FROM upload_chunks WHERE id = ?').run(id);
        return result.changes > 0;
    }

    // TRANSCODING JOBS
    async createTranscodingJob(job) {
        const stmt = this.db.prepare(`INSERT INTO transcoding_jobs (video_id, status, provider, priority, input_format, output_formats, job_id, progress, error_message, created_at, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const result = stmt.run(
            job.video_id,
            job.status || 'queued',
            job.provider || 'google_cloud',
            job.priority || 5,
            job.input_format || null,
            JSON.stringify(job.output_formats || []),
            job.job_id || null,
            job.progress || 0,
            job.error_message || null,
            job.created_at || null,
            job.started_at || null,
            job.completed_at || null
        );
        return { id: result.lastInsertRowid, ...job };
    }
    async getTranscodingJobById(id) {
        const row = this.db.prepare('SELECT * FROM transcoding_jobs WHERE id = ?').get(id);
        if (row && row.output_formats) row.output_formats = JSON.parse(row.output_formats);
        return row;
    }
    async getTranscodingJobsByVideoId(videoId) {
        const rows = this.db.prepare('SELECT * FROM transcoding_jobs WHERE video_id = ? ORDER BY created_at DESC').all(videoId);
        rows.forEach(row => { if (row.output_formats) row.output_formats = JSON.parse(row.output_formats); });
        return rows;
    }
    async updateTranscodingJob(id, updates) {
        const fields = [];
        const values = [];
        for (const key of ['status', 'provider', 'priority', 'input_format', 'output_formats', 'job_id', 'progress', 'error_message', 'started_at', 'completed_at']) {
            if (updates[key] !== undefined) {
                if (key === 'output_formats') {
                    fields.push(`${key} = ?`);
                    values.push(JSON.stringify(updates[key]));
                } else {
                    fields.push(`${key} = ?`);
                    values.push(updates[key]);
                }
            }
        }
        if (fields.length === 0) return false;
        values.push(id);
        const sql = `UPDATE transcoding_jobs SET ${fields.join(', ')} WHERE id = ?`;
        const result = this.db.prepare(sql).run(...values);
        return result.changes > 0;
    }
    async deleteTranscodingJob(id) {
        const result = this.db.prepare('DELETE FROM transcoding_jobs WHERE id = ?').run(id);
        return result.changes > 0;
    }

    // VIDEO FILES
    async createVideoFile(file) {
        const stmt = this.db.prepare(`INSERT INTO video_files (video_id, file_type, storage_provider, file_path, file_size, checksum, mime_type) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        const result = stmt.run(
            file.video_id,
            file.file_type,
            file.storage_provider,
            file.file_path,
            file.file_size,
            file.checksum,
            file.mime_type || null
        );
        return { id: result.lastInsertRowid, ...file };
    }
    async getVideoFileById(id) {
        return this.db.prepare('SELECT * FROM video_files WHERE id = ?').get(id);
    }
    async getVideoFilesByVideoId(videoId) {
        return this.db.prepare('SELECT * FROM video_files WHERE video_id = ? ORDER BY created_at DESC').all(videoId);
    }
    async updateVideoFile(id, updates) {
        const fields = [];
        const values = [];
        for (const key of ['file_type', 'storage_provider', 'file_path', 'file_size', 'checksum', 'mime_type']) {
            if (updates[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(updates[key]);
            }
        }
        if (fields.length === 0) return false;
        values.push(id);
        const sql = `UPDATE video_files SET ${fields.join(', ')} WHERE id = ?`;
        const result = this.db.prepare(sql).run(...values);
        return result.changes > 0;
    }
    async deleteVideoFile(id) {
        const result = this.db.prepare('DELETE FROM video_files WHERE id = ?').run(id);
        return result.changes > 0;
    }

    // VIDEO ANALYTICS
    async createVideoAnalytics(analytics) {
        const stmt = this.db.prepare(`INSERT INTO video_analytics (video_id, user_id, ip_address, user_agent, watch_duration, viewed_at) VALUES (?, ?, ?, ?, ?, ?)`);
        const result = stmt.run(
            analytics.video_id,
            analytics.user_id || null,
            analytics.ip_address || null,
            analytics.user_agent || null,
            analytics.watch_duration || null,
            analytics.viewed_at || null
        );
        return { id: result.lastInsertRowid, ...analytics };
    }
    async getVideoAnalyticsById(id) {
        return this.db.prepare('SELECT * FROM video_analytics WHERE id = ?').get(id);
    }
    async getAnalyticsByVideoId(video_id) {
        return this.db.prepare('SELECT * FROM video_analytics WHERE video_id = ? ORDER BY viewed_at DESC').all(video_id);
    }
    async getAnalyticsByUserId(user_id) {
        return this.db.prepare('SELECT * FROM video_analytics WHERE user_id = ? ORDER BY viewed_at DESC').all(user_id);
    }
    async listVideoAnalytics(filter = {}) {
        let sql = 'SELECT * FROM video_analytics WHERE 1=1';
        const params = [];
        if (filter.video_id) {
            sql += ' AND video_id = ?';
            params.push(filter.video_id);
        }
        if (filter.user_id) {
            sql += ' AND user_id = ?';
            params.push(filter.user_id);
        }
        if (filter.ip_address) {
            sql += ' AND ip_address = ?';
            params.push(filter.ip_address);
        }
        sql += ' ORDER BY viewed_at DESC';
        return this.db.prepare(sql).all(...params);
    }
    async deleteVideoAnalytics(id) {
        const result = this.db.prepare('DELETE FROM video_analytics WHERE id = ?').run(id);
        return result.changes > 0;
    }
}

module.exports = BetterSqliteDatabase; 