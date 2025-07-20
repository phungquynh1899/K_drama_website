const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');

describe('uploads table CRUD', () => {
  let db;
  let userId;
  
  beforeEach(async () => {
    db = BetterSqliteDatabase.getInstance(':memory:');
    // Create a user to satisfy foreign key
    const user = await db.createUser({ username: 'uploaduser', email: 'upload@b.com', password_hash: 'pw', role: 'user', is_active: 1 });
    userId = user.id;
  });

  afterEach(() => {
    db.db.close();
     //forcing _instance=null 
     BetterSqliteDatabase._instance = null
  });

  afterAll(() => {
    // Ensure singleton is reset after all tests in this file
    BetterSqliteDatabase._instance = null;
  });

  test('Create upload', async () => {
    const upload = { user_id: userId, video_id: null, filename: 'file.mp4', total_size: 1000, total_chunks: 10, uploaded_chunks: [], status: 'pending' };
    const created = await db.createUpload(upload);
    expect(created).toHaveProperty('id');
    expect(created.filename).toBe('file.mp4');
  });

  test('Read upload', async () => {
    const upload = { user_id: userId, video_id: null, filename: 'file2.mp4', total_size: 2000, total_chunks: 20, uploaded_chunks: [], status: 'pending' };
    const created = await db.createUpload(upload);
    const fetched = await db.getUploadById(created.id);
    expect(fetched.filename).toBe('file2.mp4');
  });

  test('Update upload', async () => {
    const upload = { user_id: userId, video_id: null, filename: 'file3.mp4', total_size: 3000, total_chunks: 30, uploaded_chunks: [], status: 'pending' };
    const created = await db.createUpload(upload);
    await db.updateUpload(created.id, { status: 'complete' });
    const updated = await db.getUploadById(created.id);
    expect(updated.status).toBe('complete');
  });

  test('Delete upload', async () => {
    const upload = { user_id: userId, video_id: null, filename: 'file4.mp4', total_size: 4000, total_chunks: 40, uploaded_chunks: [], status: 'pending' };
    const created = await db.createUpload(upload);
    await db.deleteUpload(created.id);
    const deleted = await db.getUploadById(created.id);
    expect(deleted).toBeUndefined();
  });

  // Edge: Null filename
  test('should not allow null filename', async () => {
    const upload = { user_id: userId, video_id: null, filename: null, total_size: 1000, total_chunks: 10, uploaded_chunks: [], status: 'pending' };
    await expect(db.createUpload(upload)).rejects.toThrow();
  });

  // Error: Invalid user_id (foreign key)
  test('should not allow invalid user_id', async () => {
    const upload = { user_id: 9999, video_id: null, filename: 'file.mp4', total_size: 1000, total_chunks: 10, uploaded_chunks: [], status: 'pending' };
    await expect(db.createUpload(upload)).rejects.toThrow();
  });

  // Error: Update non-existent upload
  test('should not update non-existent upload', async () => {
    const result = await db.updateUpload(9999, { status: 'complete' });
    expect(result).toBe(false);
  });

  // Error: Delete non-existent upload
  test('should not delete non-existent upload', async () => {
    const result = await db.deleteUpload(9999);
    expect(result).toBe(false);
  });

  // Security: SQL injection attempt in filename
  test('should prevent SQL injection in filename', async () => {
    const upload = { user_id: userId, video_id: null, filename: "file.mp4'; DROP TABLE uploads; --", total_size: 1000, total_chunks: 10, uploaded_chunks: [], status: 'pending' };
    const created = await db.createUpload(upload);
    expect(created.filename).toBe(upload.filename);
    // Table should still exist
    const check = await db.createUpload({ user_id: userId, video_id: null, filename: 'safe.mp4', total_size: 1000, total_chunks: 10, uploaded_chunks: [], status: 'pending' });
    expect(check).toHaveProperty('id');
  });
}); 