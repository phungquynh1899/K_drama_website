const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');

describe('videos table CRUD', () => {
  let db;
  let userId;

  beforeEach(async () => {
    db = BetterSqliteDatabase.getInstance(':memory:');
    // Create a user to satisfy foreign key
    const user = await db.createUser({ username: 'uploader', email: 'up@b.com', password_hash: 'pw', role: 'user', is_active: 1 });
    userId = user.id;
  });

  afterEach(() => {
    db.db.close();
  });

  test('Create video', async () => {
    const video = { title: 'Drama', description: 'desc', year: 2024, genre: 'romance', actors: ['A','B'], duration_seconds: 3600, original_filename: 'drama.mp4', uploader_user_id: userId, status: 'uploading', is_public: 1 };
    const created = await db.createVideo(video);
    expect(created).toHaveProperty('id');
    expect(created.title).toBe('Drama');
  });

  test('Read video', async () => {
    const video = { title: 'Show', description: 'desc', year: 2024, genre: 'comedy', actors: ['C'], duration_seconds: 1800, original_filename: 'show.mp4', uploader_user_id: userId, status: 'uploading', is_public: 1 };
    const created = await db.createVideo(video);
    const fetched = await db.getVideoById(created.id);
    expect(fetched.title).toBe('Show');
  });

  test('Update video', async () => {
    const video = { title: 'Old', description: 'desc', year: 2024, genre: 'action', actors: ['D'], duration_seconds: 1200, original_filename: 'old.mp4', uploader_user_id: userId, status: 'uploading', is_public: 1 };
    const created = await db.createVideo(video);
    await db.updateVideo(created.id, { title: 'New' });
    const updated = await db.getVideoById(created.id);
    expect(updated.title).toBe('New');
  });

  test('Delete video', async () => {
    const video = { title: 'Gone', description: 'desc', year: 2024, genre: 'thriller', actors: ['E'], duration_seconds: 900, original_filename: 'gone.mp4', uploader_user_id: userId, status: 'uploading', is_public: 1 };
    const created = await db.createVideo(video);
    await db.deleteVideo(created.id);
    const deleted = await db.getVideoById(created.id);
    expect(deleted).toBeUndefined();
  });

  // Edge: Missing required field (title)
  test('should not allow missing title', async () => {
    const video = { description: 'desc', year: 2024, genre: 'romance', actors: ['A'], duration_seconds: 3600, original_filename: 'drama.mp4', uploader_user_id: userId, status: 'uploading', is_public: 1 };
    await expect(db.createVideo(video)).rejects.toThrow();
  });

  // Error: Invalid uploader_user_id (foreign key)
  test('should not allow invalid uploader_user_id', async () => {
    const video = { title: 'Drama', description: 'desc', year: 2024, genre: 'romance', actors: ['A'], duration_seconds: 3600, original_filename: 'drama.mp4', uploader_user_id: 9999, status: 'uploading', is_public: 1 };
    await expect(db.createVideo(video)).rejects.toThrow();
  });

  // Error: Update non-existent video
  test('should not update non-existent video', async () => {
    const result = await db.updateVideo(9999, { title: 'Nope' });
    expect(result).toBe(false);
  });

  // Error: Delete non-existent video
  test('should not delete non-existent video', async () => {
    const result = await db.deleteVideo(9999);
    expect(result).toBe(false);
  });

  // Security: SQL injection attempt in title
  test('should prevent SQL injection in title', async () => {
    const video = { title: "Drama'; DROP TABLE videos; --", description: 'desc', year: 2024, genre: 'romance', actors: ['A'], duration_seconds: 3600, original_filename: 'drama.mp4', uploader_user_id: userId, status: 'uploading', is_public: 1 };
    const created = await db.createVideo(video);
    expect(created.title).toBe(video.title);
    // Table should still exist
    const check = await db.createVideo({ title: 'Safe', description: 'desc', year: 2024, genre: 'romance', actors: ['A'], duration_seconds: 3600, original_filename: 'safe.mp4', uploader_user_id: userId, status: 'uploading', is_public: 1 });
    expect(check).toHaveProperty('id');
  });
}); 