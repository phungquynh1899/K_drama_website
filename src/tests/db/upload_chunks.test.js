const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');

describe('upload_chunks table CRUD', () => {
  let db;
  let userId;
  let uploadId;

  beforeEach(async () => {
    db = BetterSqliteDatabase.getInstance(':memory:');
    // Create a user and upload to satisfy foreign keys
    const user = await db.createUser({ username: 'chunkuser', email: 'chunk@b.com', password_hash: 'pw', role: 'user', is_active: 1 });
    userId = user.id;
    const upload = await db.createUpload({ id: 1234567890123456, user_id: userId, video_id: null, filename: 'file.mp4', total_size: 1000, total_chunks: 10, uploaded_chunks: [], status: 'pending' });
    uploadId = upload.id;
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

  test('Create upload_chunk', async () => {
    const chunk = { upload_id: uploadId, chunk_number: 1, chunk_size: 100, checksum: 'abc', status: 'pending', uploaded_at: null, verified_at: null };
    const created = await db.createUploadChunk(chunk);
    expect(created).toHaveProperty('id');
    expect(created.chunk_number).toBe(1);
  });

  test('Read upload_chunk', async () => {
    const chunk = { upload_id: uploadId, chunk_number: 2, chunk_size: 200, checksum: 'def', status: 'pending', uploaded_at: null, verified_at: null };
    await db.createUploadChunk(chunk);
    const fetched = await db.getUploadChunk(uploadId, 2);
    expect(fetched.checksum).toBe('def');
  });

  test('Update upload_chunk', async () => {
    const chunk = { upload_id: uploadId, chunk_number: 3, chunk_size: 300, checksum: 'ghi', status: 'pending', uploaded_at: null, verified_at: null };
    const created = await db.createUploadChunk(chunk);
    await db.updateUploadChunk(created.id, { status: 'uploaded' });
    const updated = await db.getUploadChunk(uploadId, 3);
    expect(updated.status).toBe('uploaded');
  });

  test('Delete upload_chunk', async () => {
    const chunk = { upload_id: uploadId, chunk_number: 4, chunk_size: 400, checksum: 'jkl', status: 'pending', uploaded_at: null, verified_at: null };
    const created = await db.createUploadChunk(chunk);
    await db.deleteUploadChunk(created.id);
    const deleted = await db.getUploadChunk(uploadId, 4);
    expect(deleted).toBeUndefined();
  });

  // Edge: Duplicate (upload_id, chunk_number)
  test('should not allow duplicate chunk_number for same upload', async () => {
    const chunk = { upload_id: uploadId, chunk_number: 1, chunk_size: 100, checksum: 'abc', status: 'pending', uploaded_at: null, verified_at: null };
    await db.createUploadChunk(chunk);
    await expect(db.createUploadChunk(chunk)).rejects.toThrow();
  });

  // Edge: Null chunk_number
  test('should not allow null chunk_number', async () => {
    const chunk = { upload_id: uploadId, chunk_number: null, chunk_size: 100, checksum: 'abc', status: 'pending', uploaded_at: null, verified_at: null };
    await expect(db.createUploadChunk(chunk)).rejects.toThrow();
  });

  // Error: Invalid upload_id (foreign key)
  test('should not allow invalid upload_id', async () => {
    const chunk = { upload_id: 9999, chunk_number: 2, chunk_size: 100, checksum: 'abc', status: 'pending', uploaded_at: null, verified_at: null };
    await expect(db.createUploadChunk(chunk)).rejects.toThrow();
  });

  // Error: Update non-existent chunk
  test('should not update non-existent chunk', async () => {
    const result = await db.updateUploadChunk(9999, { status: 'uploaded' });
    expect(result).toBe(false);
  });

  // Error: Delete non-existent chunk
  test('should not delete non-existent chunk', async () => {
    const result = await db.deleteUploadChunk(9999);
    expect(result).toBe(false);
  });

  // Security: SQL injection attempt in checksum
  test('should prevent SQL injection in checksum', async () => {
    const chunk = { upload_id: uploadId, chunk_number: 5, chunk_size: 100, checksum: "abc'; DROP TABLE upload_chunks; --", status: 'pending', uploaded_at: null, verified_at: null };
    const created = await db.createUploadChunk(chunk);
    expect(created.checksum).toBe(chunk.checksum);
    // Table should still exist
    const check = await db.createUploadChunk({ upload_id: uploadId, chunk_number: 6, chunk_size: 100, checksum: 'safe', status: 'pending', uploaded_at: null, verified_at: null });
    expect(check).toHaveProperty('id');
  });
}); 