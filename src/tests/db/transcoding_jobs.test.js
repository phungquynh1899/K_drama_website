const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');

describe('transcoding_jobs table CRUD', () => {
  let db;
  let userId;
  let videoId;

  beforeEach(async () => {
    db = BetterSqliteDatabase.getInstance(':memory:');
    // Create a user and video to satisfy foreign keys
    const user = await db.createUser({ username: 'transcoder', email: 'trans@b.com', password_hash: 'pw', role: 'user', is_active: 1 });
    userId = user.id;
    const video = await db.createVideo({ title: 'Transcode', description: 'desc', year: 2024, genre: 'sci-fi', actors: ['A'], duration_seconds: 1000, original_filename: 'trans.mp4', uploader_user_id: userId, status: 'uploading', is_public: 1 });
    videoId = video.id;
  });

  afterEach(() => {
    db.db.close();
  });

  test('Create transcoding_job', async () => {
    const job = { video_id: videoId, status: 'queued', provider: 'google_cloud', priority: 5, input_format: 'mp4', output_formats: ['mp4'], job_id: 'job1', progress: 0, error_message: null, created_at: null, started_at: null, completed_at: null };
    const created = await db.createTranscodingJob(job);
    expect(created).toHaveProperty('id');
    expect(created.status).toBe('queued');
  });

  test('Read transcoding_job', async () => {
    const job = { video_id: videoId, status: 'queued', provider: 'google_cloud', priority: 5, input_format: 'mp4', output_formats: ['mp4'], job_id: 'job2', progress: 0, error_message: null, created_at: null, started_at: null, completed_at: null };
    const created = await db.createTranscodingJob(job);
    const fetched = await db.getTranscodingJobById(created.id);
    expect(fetched.job_id).toBe('job2');
  });

  test('Update transcoding_job', async () => {
    const job = { video_id: videoId, status: 'queued', provider: 'google_cloud', priority: 5, input_format: 'mp4', output_formats: ['mp4'], job_id: 'job3', progress: 0, error_message: null, created_at: null, started_at: null, completed_at: null };
    const created = await db.createTranscodingJob(job);
    await db.updateTranscodingJob(created.id, { status: 'processing' });
    const updated = await db.getTranscodingJobById(created.id);
    expect(updated.status).toBe('processing');
  });

  test('Delete transcoding_job', async () => {
    const job = { video_id: videoId, status: 'queued', provider: 'google_cloud', priority: 5, input_format: 'mp4', output_formats: ['mp4'], job_id: 'job4', progress: 0, error_message: null, created_at: null, started_at: null, completed_at: null };
    const created = await db.createTranscodingJob(job);
    await db.deleteTranscodingJob(created.id);
    const deleted = await db.getTranscodingJobById(created.id);
    expect(deleted).toBeUndefined();
  });

  // Edge: Null status
  test('should not allow null status', async () => {
    const job = { video_id: videoId, status: null, provider: 'google_cloud', priority: 5, input_format: 'mp4', output_formats: ['mp4'], job_id: 'jobx', progress: 0, error_message: null, created_at: null, started_at: null, completed_at: null };
    await expect(db.createTranscodingJob(job)).rejects.toThrow();
  });

  // Error: Invalid video_id (foreign key)
  test('should not allow invalid video_id', async () => {
    const job = { video_id: 9999, status: 'queued', provider: 'google_cloud', priority: 5, input_format: 'mp4', output_formats: ['mp4'], job_id: 'joby', progress: 0, error_message: null, created_at: null, started_at: null, completed_at: null };
    await expect(db.createTranscodingJob(job)).rejects.toThrow();
  });

  // Error: Update non-existent job
  test('should not update non-existent job', async () => {
    const result = await db.updateTranscodingJob(9999, { status: 'processing' });
    expect(result).toBe(false);
  });

  // Error: Delete non-existent job
  test('should not delete non-existent job', async () => {
    const result = await db.deleteTranscodingJob(9999);
    expect(result).toBe(false);
  });

  // Security: SQL injection attempt in job_id
  test('should prevent SQL injection in job_id', async () => {
    const job = { video_id: videoId, status: 'queued', provider: 'google_cloud', priority: 5, input_format: 'mp4', output_formats: ['mp4'], job_id: "job'; DROP TABLE transcoding_jobs; --", progress: 0, error_message: null, created_at: null, started_at: null, completed_at: null };
    const created = await db.createTranscodingJob(job);
    expect(created.job_id).toBe(job.job_id);
    // Table should still exist
    const check = await db.createTranscodingJob({ video_id: videoId, status: 'queued', provider: 'google_cloud', priority: 5, input_format: 'mp4', output_formats: ['mp4'], job_id: 'safe', progress: 0, error_message: null, created_at: null, started_at: null, completed_at: null });
    expect(check).toHaveProperty('id');
  });
}); 