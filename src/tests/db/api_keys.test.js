const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');

describe('api_keys table CRUD', () => {
  let db;
  let userId;

  beforeEach(async () => {
    db = BetterSqliteDatabase.getInstance(':memory:');
    // Create a user to satisfy foreign key
    const user = await db.createUser({ username: 'apiuser', email: 'api@b.com', password_hash: 'pw', role: 'user', is_active: 1 });
    userId = user.id;
  });

  afterEach(() => {
    db.db.close();
  });

  test('Create api_key', async () => {
    const apiKey = { user_id: userId, api_key: 'key123', name: 'main', is_active: 1 };
    const created = await db.createApiKey(apiKey);
    expect(created).toHaveProperty('id');
    expect(created.api_key).toBe('key123');
  });

  test('Read api_key', async () => {
    const apiKey = { user_id: userId, api_key: 'key456', name: 'read', is_active: 1 };
    const created = await db.createApiKey(apiKey);
    const fetched = await db.getApiKeyById(created.id);
    expect(fetched.api_key).toBe('key456');
  });

  test('Update api_key (deactivate)', async () => {
    const apiKey = { user_id: userId, api_key: 'key789', name: 'update', is_active: 1 };
    const created = await db.createApiKey(apiKey);
    await db.deactivateApiKey(created.id);
    const updated = await db.getApiKeyById(created.id);
    expect(updated.is_active).toBe(0);
  });

  test('Delete api_key', async () => {
    const apiKey = { user_id: userId, api_key: 'key000', name: 'delete', is_active: 1 };
    const created = await db.createApiKey(apiKey);
    await db.deleteApiKey(created.id);
    const deleted = await db.getApiKeyById(created.id);
    expect(deleted).toBeUndefined();
  });

  // Edge: Duplicate api_key
  test('should not allow duplicate api_key', async () => {
    const apiKey = { user_id: userId, api_key: 'dupkey', name: 'main', is_active: 1 };
    await db.createApiKey(apiKey);
    await expect(db.createApiKey({ ...apiKey, name: 'other' })).rejects.toThrow();
  });

  // Edge: Null api_key
  test('should not allow null api_key', async () => {
    const apiKey = { user_id: userId, api_key: null, name: 'null', is_active: 1 };
    await expect(db.createApiKey(apiKey)).rejects.toThrow();
  });

  // Error: Invalid user_id (foreign key)
  test('should not allow invalid user_id', async () => {
    const apiKey = { user_id: 9999, api_key: 'baduser', name: 'bad', is_active: 1 };
    await expect(db.createApiKey(apiKey)).rejects.toThrow();
  });

  // Error: Deactivate non-existent api_key
  test('should not deactivate non-existent api_key', async () => {
    const result = await db.deactivateApiKey(9999);
    expect(result).toBe(false);
  });

  // Error: Delete non-existent api_key
  test('should not delete non-existent api_key', async () => {
    const result = await db.deleteApiKey(9999);
    expect(result).toBe(false);
  });

  // Security: SQL injection attempt in api_key
  test('should prevent SQL injection in api_key', async () => {
    const apiKey = { user_id: userId, api_key: "key'; DROP TABLE api_keys; --", name: 'inject', is_active: 1 };
    const created = await db.createApiKey(apiKey);
    expect(created.api_key).toBe(apiKey.api_key);
    // Table should still exist
    const check = await db.createApiKey({ user_id: userId, api_key: 'safe', name: 'safe', is_active: 1 });
    expect(check).toHaveProperty('id');
  });
}); 