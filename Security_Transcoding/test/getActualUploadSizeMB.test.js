const fs = require('fs');
const path = require('path');
const uploadService = require('../src/services/upload/upload.service');

describe('getActualUploadSizeMB Function Test', () => {
  const testUploadId = 'test_upload_456';
  const correctChunkDir = path.join(__dirname, '../src/public/uploads/tmp', testUploadId);
  const wrongChunkDir = path.join(__dirname, '../src/public/uploads', testUploadId);

  beforeEach(() => {
    // Clean up any existing test directories
    if (fs.existsSync(correctChunkDir)) {
      fs.rmSync(correctChunkDir, { recursive: true, force: true });
    }
    if (fs.existsSync(wrongChunkDir)) {
      fs.rmSync(wrongChunkDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up after tests
    if (fs.existsSync(correctChunkDir)) {
      fs.rmSync(correctChunkDir, { recursive: true, force: true });
    }
    if (fs.existsSync(wrongChunkDir)) {
      fs.rmSync(wrongChunkDir, { recursive: true, force: true });
    }
  });

  test('should find chunks in correct directory (tmp)', () => {
    // Create chunks in the CORRECT directory (tmp)
    fs.mkdirSync(correctChunkDir, { recursive: true });
    const chunkPath = path.join(correctChunkDir, 'chunk_0');
    const chunkSize = 64 * 1024 * 1024; // 64MB
    const buffer = Buffer.alloc(chunkSize);
    fs.writeFileSync(chunkPath, buffer);
    
    // Create chunks in the WRONG directory (where old function used to look)
    fs.mkdirSync(wrongChunkDir, { recursive: true });
    const wrongChunkPath = path.join(wrongChunkDir, 'chunk_0');
    const wrongBuffer = Buffer.alloc(32 * 1024 * 1024); // 32MB
    fs.writeFileSync(wrongChunkPath, wrongBuffer);
    
    // Function should now find chunks in the correct directory
    const result = uploadService.getActualUploadSizeMB(testUploadId);
    expect(result).toBe(64); // Should find 64MB from correct directory
  });

  test('should return 0 when no chunks exist in correct directory', () => {
    // Create chunks only in wrong directory
    fs.mkdirSync(wrongChunkDir, { recursive: true });
    const wrongChunkPath = path.join(wrongChunkDir, 'chunk_0');
    const wrongBuffer = Buffer.alloc(32 * 1024 * 1024); // 32MB
    fs.writeFileSync(wrongChunkPath, wrongBuffer);
    
    // Function should return 0 since it looks in correct directory
    const result = uploadService.getActualUploadSizeMB(testUploadId);
    expect(result).toBe(0); // Should return 0 since no chunks in correct directory
  });

  test('should calculate total size from multiple chunks in correct directory', () => {
    // Create multiple chunks in the correct directory
    fs.mkdirSync(correctChunkDir, { recursive: true });
    
    const chunks = [
      { name: 'chunk_0', size: 64 * 1024 * 1024 }, // 64MB
      { name: 'chunk_1', size: 32 * 1024 * 1024 }, // 32MB
      { name: 'chunk_2', size: 16 * 1024 * 1024 }  // 16MB
    ];
    
    chunks.forEach(chunk => {
      const chunkPath = path.join(correctChunkDir, chunk.name);
      const buffer = Buffer.alloc(chunk.size);
      fs.writeFileSync(chunkPath, buffer);
    });
    
    const result = uploadService.getActualUploadSizeMB(testUploadId);
    expect(result).toBe(112); // 64 + 32 + 16 = 112MB
  });

  test('should ignore non-chunk files in correct directory', () => {
    // Create directory with chunk and non-chunk files
    fs.mkdirSync(correctChunkDir, { recursive: true });
    
    // Create a chunk file
    const chunkPath = path.join(correctChunkDir, 'chunk_0');
    const chunkSize = 64 * 1024 * 1024; // 64MB
    const buffer = Buffer.alloc(chunkSize);
    fs.writeFileSync(chunkPath, buffer);
    
    // Create non-chunk files
    const otherFiles = ['metadata.json', 'temp.txt', 'chunk_info.log'];
    otherFiles.forEach(file => {
      const filePath = path.join(correctChunkDir, file);
      fs.writeFileSync(filePath, 'test data');
    });
    
    const result = uploadService.getActualUploadSizeMB(testUploadId);
    expect(result).toBe(64); // Should only count chunk files
  });
}); 