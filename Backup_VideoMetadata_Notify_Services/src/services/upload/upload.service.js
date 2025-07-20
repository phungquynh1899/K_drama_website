const fs = require('fs');
const path = require('path');

exports.handleUpload = async (file) => {
  // Placeholder for future logic (e.g., save to DB, trigger transcoding)
  // For now, just resolve
  return Promise.resolve();
};

exports.handleChunkUpload = async (file, uploadId, chunkIndex) => {
  // Multer already saves the chunk, nothing to do here for now
  return Promise.resolve();
};

exports.mergeChunks = async (uploadId, totalChunks, filename) => {
  const tmpDir = path.join(__dirname, '../../public/uploads/tmp', String(uploadId));
  const finalDir = path.join(__dirname, '../../public/uploads');

  // Ensure the finalDir exists
  if (!fs.existsSync(finalDir)) {
    fs.mkdirSync(finalDir, { recursive: true });
  }

  // Extract extension from filename
  const ext = path.extname(filename) || '.mp4'; // default to .mp4 if missing
  const baseName = path.basename(filename, ext);
  const finalPath = path.join(finalDir, `${baseName}${ext}`);

  // Check chunk sizes are powers of 2 (2,4,8,16,32,64 MB)
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(tmpDir, `chunk_${i}`);
    if (!fs.existsSync(chunkPath)) {
      throw new Error(`Missing chunk ${i}`);
    }
    const stats = fs.statSync(chunkPath);
    const sizeMB = stats.size / (1024 * 1024);
    if (![2,4,8,16,32,64].includes(Math.round(sizeMB)) && i !== totalChunks-1) {
      throw new Error(`Chunk ${i} size ${sizeMB}MB is not a power of 2 (except last chunk)`);
    }
  }

  // Merge chunks
  const writeStream = fs.createWriteStream(finalPath);
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(tmpDir, `chunk_${i}`);
    await new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(chunkPath);
      readStream.on('end', resolve);
      readStream.on('error', reject);
      readStream.pipe(writeStream, { end: false });
    });
  }
  writeStream.end();

  // Clean up temp chunks
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(tmpDir, `chunk_${i}`);
    fs.unlinkSync(chunkPath);
  }
  fs.rmdirSync(tmpDir);

  return finalPath;
};

exports.verifyChunksComplete = async (uploadId, totalChunks, filename) => {
  const tmpDir = path.join(__dirname, '../../public/uploads/tmp', uploadId);

  console.log(`Verifying chunks for uploadId: ${uploadId}, expected chunks: ${totalChunks}`);

  // Check for missing chunks
  const missingChunks = [];
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(tmpDir, `chunk_${i}`);
    if (!fs.existsSync(chunkPath)) {
      missingChunks.push(i);
    }
  }

  if (missingChunks.length > 0) {
    const error = new Error(`Missing chunks: ${missingChunks.join(', ')}`);
    error.missingChunks = missingChunks;
    throw error;
  }

  // Optionally: Check chunk sizes are powers of 2 (2,4,8,16,32,64 MB)
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(tmpDir, `chunk_${i}`);
    const stats = fs.statSync(chunkPath);
    const sizeMB = stats.size / (1024 * 1024);
    console.log(`Chunk ${i}: ${sizeMB.toFixed(2)}MB`);
    if (![2,4,8,16,32,64].includes(Math.round(sizeMB)) && i !== totalChunks-1) {
      console.warn(`Chunk ${i} size ${sizeMB}MB is not a power of 2 (except last chunk)`);
    }
  }

  console.log(`All ${totalChunks} chunks verified successfully for uploadId: ${uploadId}`);

  return {
    chunkDirectory: tmpDir,
    totalChunks,
    uploadId,
    filename
  };
};

exports.getChunkInfo = async (uploadId) => {
  const tmpDir = path.join(__dirname, '../../public/uploads/tmp', uploadId);
  
  if (!fs.existsSync(tmpDir)) {
    throw new Error(`Upload directory not found for uploadId: ${uploadId}`);
  }
  
  const chunks = [];
  const files = fs.readdirSync(tmpDir);
  
  for (const file of files) {
    if (file.startsWith('chunk_')) {
      const chunkIndex = parseInt(file.replace('chunk_', ''));
      const chunkPath = path.join(tmpDir, file);
      const stats = fs.statSync(chunkPath);
      
      chunks.push({
        index: chunkIndex,
        path: chunkPath,
        size: stats.size,
        sizeMB: (stats.size / (1024 * 1024)).toFixed(2)
      });
    }
  }
  
  // Sort by chunk index
  chunks.sort((a, b) => a.index - b.index);
  
  return {
    uploadId,
    chunkDirectory: tmpDir,
    totalChunks: chunks.length,
    chunks: chunks,
    totalSize: chunks.reduce((sum, chunk) => sum + chunk.size, 0)
  };
};
