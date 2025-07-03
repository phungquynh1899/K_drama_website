const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase.js');

describe('BetterSqliteDatabase Table Creation', () => {
  let db;

  beforeEach(() => {
    db = BetterSqliteDatabase.getInstance(':memory:');
  });

  afterEach(() => {
    db.db.close();
  });

  const expectedTables = [
    'users',
    'videos',
    'api_keys',
    'keys',
    'uploads',
    'upload_chunks',
    'transcoding_jobs',
    'video_files',
    'user_sessions',
    'video_analytics',
    'comments',
  ];

  test('creates all expected tables on initialization', () => {
    const tables = db.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all();
    const tableNames = tables.map(t => t.name);
    for (const table of expectedTables) {
      expect(tableNames).toContain(table);
    }
  });
}); 