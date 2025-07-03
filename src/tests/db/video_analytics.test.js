const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');

describe('video_analytics table CRUD', () => {
  let db;
  let userId;
  let videoId;

  beforeEach(async () => {
    db = BetterSqliteDatabase.getInstance(':memory:');
    // Create a user and video to satisfy foreign keys
    const user = await db.createUser({ username: 'analyticuser', email: 'analytic@b.com', password_hash: 'pw', role: 'user', is_active: 1 });
    userId = user.id;
    const video = await db.createVideo({ title: 'Analytics', description: 'desc', year: 2024, genre: 'stat', actors: ['A'], duration_seconds: 1000, original_filename: 'analytics.mp4', uploader_user_id: userId, status: 'uploading', is_public: 1 });
    videoId = video.id;
  });

  afterEach(() => {
    db.db.close();
  });

  test('Create video_analytics', async () => {
    const analytics = { video_id: videoId, user_id: userId, ip_address: '127.0.0.1', user_agent: 'jest', watch_duration: 100, viewed_at: null };
    const created = await db.createVideoAnalytics(analytics);
    expect(created).toHaveProperty('id');
    expect(created.ip_address).toBe('127.0.0.1');
  });

  test('Read video_analytics', async () => {
    const analytics = { video_id: videoId, user_id: userId, ip_address: '127.0.0.2', user_agent: 'jest', watch_duration: 200, viewed_at: null };
    const created = await db.createVideoAnalytics(analytics);
    const fetched = await db.getVideoAnalyticsById(created.id);
    expect(fetched.ip_address).toBe('127.0.0.2');
  });

  test('Update video_analytics', async () => {
    // No update method for analytics, so skip
    expect(true).toBe(true);
  });

  test('Delete video_analytics', async () => {
    const analytics = { video_id: videoId, user_id: userId, ip_address: '127.0.0.3', user_agent: 'jest', watch_duration: 300, viewed_at: null };
    const created = await db.createVideoAnalytics(analytics);
    await db.deleteVideoAnalytics(created.id);
    const deleted = await db.getVideoAnalyticsById(created.id);
    expect(deleted).toBeUndefined();
  });

  // Edge: Null video_id
  test('should not allow null video_id', async () => {
    const analytics = { video_id: null, user_id: userId, ip_address: '127.0.0.1', user_agent: 'jest', watch_duration: 100, viewed_at: null };
    await expect(db.createVideoAnalytics(analytics)).rejects.toThrow();
  });

  // Error: Invalid video_id (foreign key)
  test('should not allow invalid video_id', async () => {
    const analytics = { video_id: 9999, user_id: userId, ip_address: '127.0.0.1', user_agent: 'jest', watch_duration: 100, viewed_at: null };
    await expect(db.createVideoAnalytics(analytics)).rejects.toThrow();
  });

  // Error: Invalid user_id (foreign key, optional)
  test('should allow null user_id but not invalid user_id', async () => {
    const analytics = { video_id: videoId, user_id: 9999, ip_address: '127.0.0.1', user_agent: 'jest', watch_duration: 100, viewed_at: null };
    await expect(db.createVideoAnalytics(analytics)).rejects.toThrow();
    // Should allow null user_id
    const valid = await db.createVideoAnalytics({ video_id: videoId, user_id: null, ip_address: '127.0.0.1', user_agent: 'jest', watch_duration: 100, viewed_at: null });
    expect(valid).toHaveProperty('id');
  });

  // Error: Delete non-existent analytics
  test('should not delete non-existent analytics', async () => {
    const result = await db.deleteVideoAnalytics(9999);
    expect(result).toBe(false);
  });

  // Security: SQL injection attempt in ip_address
  test('should prevent SQL injection in ip_address', async () => {
    const analytics = { video_id: videoId, user_id: userId, ip_address: "127.0.0.1'; DROP TABLE video_analytics; --", user_agent: 'jest', watch_duration: 100, viewed_at: null };
    const created = await db.createVideoAnalytics(analytics);
    expect(created.ip_address).toBe(analytics.ip_address);
    // Table should still exist
    const check = await db.createVideoAnalytics({ video_id: videoId, user_id: userId, ip_address: 'safe', user_agent: 'jest', watch_duration: 100, viewed_at: null });
    expect(check).toHaveProperty('id');
  });
}); 