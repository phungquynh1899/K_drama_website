const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');

describe('video_files table CRUD', () => {
  let db;
  let userId;
  let videoId;

  beforeEach(async () => {
    db = BetterSqliteDatabase.getInstance(':memory:');
    // Create a user and video to satisfy foreign keys
    const user = await db.createUser({ username: 'fileuser', email: 'file@b.com', password_hash: 'pw', role: 'user', is_active: 1 });
    userId = user.id;
    const video = await db.createVideo({ title: 'File', description: 'desc', year: 2024, genre: 'doc', actors: ['A'], duration_seconds: 1000, original_filename: 'file.mp4', uploader_user_id: userId, status: 'uploading', is_public: 1 });
    videoId = video.id;
  });

  afterEach(() => {
    db.db.close();
  });

  test('Create video_file', async () => {
    const file = { video_id: videoId, file_type: 'mp4', storage_provider: 'local', file_path: '/tmp/file.mp4', file_size: 1000, checksum: 'abc', mime_type: 'video/mp4' };
    const created = await db.createVideoFile(file);
    expect(created).toHaveProperty('id');
    expect(created.file_type).toBe('mp4');
  });

  test('Read video_file', async () => {
    const file = { video_id: videoId, file_type: 'mkv', storage_provider: 'local', file_path: '/tmp/file2.mkv', file_size: 2000, checksum: 'def', mime_type: 'video/x-matroska' };
    const created = await db.createVideoFile(file);
    const fetched = await db.getVideoFileById(created.id);
    expect(fetched.file_type).toBe('mkv');
  });

  test('Update video_file', async () => {
    const file = { video_id: videoId, file_type: 'avi', storage_provider: 'local', file_path: '/tmp/file3.avi', file_size: 3000, checksum: 'ghi', mime_type: 'video/x-msvideo' };
    const created = await db.createVideoFile(file);
    await db.updateVideoFile(created.id, { file_type: 'mp4' });
    const updated = await db.getVideoFileById(created.id);
    expect(updated.file_type).toBe('mp4');
  });

  test('Delete video_file', async () => {
    const file = { video_id: videoId, file_type: 'mov', storage_provider: 'local', file_path: '/tmp/file4.mov', file_size: 4000, checksum: 'jkl', mime_type: 'video/quicktime' };
    const created = await db.createVideoFile(file);
    await db.deleteVideoFile(created.id);
    const deleted = await db.getVideoFileById(created.id);
    expect(deleted).toBeUndefined();
  });

  // Edge: Null file_type
  test('should not allow null file_type', async () => {
    const file = { video_id: videoId, file_type: null, storage_provider: 'local', file_path: '/tmp/file.mp4', file_size: 1000, checksum: 'abc', mime_type: 'video/mp4' };
    await expect(db.createVideoFile(file)).rejects.toThrow();
  });

  // Error: Invalid video_id (foreign key)
  test('should not allow invalid video_id', async () => {
    const file = { video_id: 9999, file_type: 'mp4', storage_provider: 'local', file_path: '/tmp/file.mp4', file_size: 1000, checksum: 'abc', mime_type: 'video/mp4' };
    await expect(db.createVideoFile(file)).rejects.toThrow();
  });

  // Error: Update non-existent file
  test('should not update non-existent file', async () => {
    const result = await db.updateVideoFile(9999, { file_type: 'mkv' });
    expect(result).toBe(false);
  });

  // Error: Delete non-existent file
  test('should not delete non-existent file', async () => {
    const result = await db.deleteVideoFile(9999);
    expect(result).toBe(false);
  });

  // Security: SQL injection attempt in file_path
  test('should prevent SQL injection in file_path', async () => {
    const file = { video_id: videoId, file_type: 'mp4', storage_provider: 'local', file_path: "/tmp/file.mp4'; DROP TABLE video_files; --", file_size: 1000, checksum: 'abc', mime_type: 'video/mp4' };
    const created = await db.createVideoFile(file);
    expect(created.file_path).toBe(file.file_path);
    // Table should still exist
    const check = await db.createVideoFile({ video_id: videoId, file_type: 'mp4', storage_provider: 'local', file_path: '/tmp/safe.mp4', file_size: 1000, checksum: 'safe', mime_type: 'video/mp4' });
    expect(check).toHaveProperty('id');
  });
}); 