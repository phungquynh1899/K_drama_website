const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');

describe('users table CRUD', () => {
  let db;

  beforeEach(() => {
    db = BetterSqliteDatabase.getInstance(':memory:');
  });

  afterEach(() => {
    db.db.close();
  });

  test('Create user', async () => {
    const user = { username: 'alice', email: 'a@b.com', password_hash: 'pw', role: 'user', is_active: 1 };
    const created = await db.createUser(user);
    expect(created).toHaveProperty('id');
    expect(created.username).toBe('alice');
  });

  test('Read user', async () => {
    const user = { username: 'bob', email: 'b@b.com', password_hash: 'pw', role: 'user', is_active: 1 };
    const created = await db.createUser(user);
    const fetched = await db.getUserById(created.id);
    expect(fetched.username).toBe('bob');
  });

  test('Update user', async () => {
    const user = { username: 'carol', email: 'c@b.com', password_hash: 'pw', role: 'user', is_active: 1 };
    const created = await db.createUser(user);
    await db.updateUser(created.id, { email: 'new@b.com' });
    const updated = await db.getUserById(created.id);
    expect(updated.email).toBe('new@b.com');
  });

  test('Delete user', async () => {
    const user = { username: 'dan', email: 'd@b.com', password_hash: 'pw', role: 'user', is_active: 1 };
    const created = await db.createUser(user);
    await db.deleteUser(created.id);
    const deleted = await db.getUserById(created.id);
    expect(deleted).toBeUndefined();
  });

  // Edge: Duplicate username
  test('should not allow duplicate usernames', async () => {
    const user = { username: 'dupe', email: 'dupe@b.com', password_hash: 'pw', role: 'user', is_active: 1 };
    await db.createUser(user);
    await expect(db.createUser({ ...user, email: 'other@b.com' })).rejects.toThrow();
  });

  // Edge: Duplicate email
  test('should not allow duplicate emails', async () => {
    const user = { username: 'unique1', email: 'unique@b.com', password_hash: 'pw', role: 'user', is_active: 1 };
    await db.createUser(user);
    await expect(db.createUser({ ...user, username: 'unique2' })).rejects.toThrow();
  });

  // Edge: Null username
  test('should not allow null username', async () => {
    const user = { username: null, email: 'null@b.com', password_hash: 'pw', role: 'user', is_active: 1 };
    await expect(db.createUser(user)).rejects.toThrow();
  });

  // Edge: Empty username
  test('should not allow empty username', async () => {
    const user = { username: '', email: 'empty@b.com', password_hash: 'pw', role: 'user', is_active: 1 };
    await expect(db.createUser(user)).rejects.toThrow();
  });

  // Error: Update non-existent user
  test('should not update non-existent user', async () => {
    const result = await db.updateUser(9999, { email: 'no@b.com' });
    expect(result).toBe(false);
  });

  // Error: Delete non-existent user
  test('should not delete non-existent user', async () => {
    const result = await db.deleteUser(9999);
    expect(result).toBe(false);
  });

  // Security: SQL injection attempt (should not succeed)
  test('should prevent SQL injection in username', async () => {
    const user = { username: "alice'; DROP TABLE users; --", email: 'inject@b.com', password_hash: 'pw', role: 'user', is_active: 1 };
    const created = await db.createUser(user);
    expect(created.username).toBe(user.username);
    // Table should still exist
    const check = await db.createUser({ username: 'safe', email: 'safe@b.com', password_hash: 'pw', role: 'user', is_active: 1 });
    expect(check).toHaveProperty('id');
  });
}); 