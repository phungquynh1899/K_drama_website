const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('../../config/laptop-config');
const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');

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
  const tmpDir = path.join(__dirname, '../../public/uploads/tmp', uploadId);
  const finalDir = path.join(__dirname, '../../public/uploads');
  const finalPath = path.join(finalDir, filename);

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
  
  let totalSize = 0;
  
  // Check that all chunks are present
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(tmpDir, `chunk_${i}`);
    if (!fs.existsSync(chunkPath)) {
      throw new Error(`Missing chunk ${i}`);
    }
    
    // Optional: Check chunk sizes are powers of 2 (2,4,8,16,32,64 MB)
    const stats = fs.statSync(chunkPath);
    const sizeMB = stats.size / (1024 * 1024);
    totalSize += stats.size;
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
    filename,
    totalSize
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

/**
 * Check with Server B if upload can be accepted. If not, update DB status to 'pending'.
 * @param {string} uploadId
 * @param {string} filename
 * @param {number} totalSizeMB - Total size of all chunks in MB
 * @param {string} notifyUrl - URL for Server B to notify when ready
 * @returns {Promise<'accepted'|'pending'>}
 */
exports.checkWithServerBAndUpdateStatus = async (uploadId, userId, filename, totalSizeMB, notifyUrl) => {
  try {
    // First, check if Server B can accept the upload
    const checkResponse = await axios.post(
      `http://localhost:3002/api/v1/upload/can-accept-upload`,
      { 
        requiredSpaceMB: totalSizeMB,
        notifyUrl: notifyUrl,
        uploadId: uploadId,
        userId: userId
      },
      { timeout: config.serverB.timeouts.canAcceptUpload }
    );

    if (checkResponse.data && checkResponse.data.canAccept === true) {
      // Server B can accept, just wait util server B send request to /transfer/transferFileFromServerAtoServerB
      // await sendChunksToServerB(uploadId, checkResponse.data.serverB_chunk_URL,checkResponse.data.serverB_complete_URL );
      await BetterSqliteDatabase.getInstance().updateUpload(uploadId, { status: 'pending' });
      return 'pending';
    }
  } catch (err) {
    // On error, update status to 'pending'
    await BetterSqliteDatabase.getInstance().updateUpload(uploadId, { status: 'pending' });
    return 'pending';
  }
};


