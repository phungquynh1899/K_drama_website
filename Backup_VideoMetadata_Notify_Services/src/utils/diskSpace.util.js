const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Get available disk space for a given directory path
 * Works on both Windows and Linux
 * @param {string} dirPath - Directory path to check
 * @returns {Promise<number>} Available space in bytes
 */
async function getAvailableDiskSpace(dirPath) {
  return new Promise((resolve, reject) => {
    // Ensure the directory exists or get its parent
    let checkPath = dirPath;
    if (!fs.existsSync(dirPath)) {
      checkPath = path.dirname(dirPath);
    }

    fs.statfs(checkPath, (err, stats) => {
      if (err) {
        // Fallback for Windows or if statfs fails
        try {
          // For Windows, we'll use a different approach
          if (process.platform === 'win32') {
            // Windows fallback - check if we can write a test file
            const testFile = path.join(checkPath, '.disk-space-test');
            try {
              fs.writeFileSync(testFile, 'test');
              fs.unlinkSync(testFile);
              // If we can write, assume we have space
              resolve(1024 * 1024 * 1024); // Assume 1GB available
            } catch (writeErr) {
              resolve(0); // No space available
            }
          } else {
            reject(err);
          }
        } catch (fallbackErr) {
          reject(fallbackErr);
        }
        return;
      }

      // Calculate available space in bytes
      const availableBytes = stats.bavail * stats.bsize;
      resolve(availableBytes);
    });
  });
}

/**
 * Format bytes to human readable string
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string (e.g., "1.5 GB")
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Parse size string to bytes
 * @param {string} sizeStr - Size string (e.g., "50MB", "1GB")
 * @returns {number} Size in bytes
 */
function parseSize(sizeStr) {
  const units = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024
  };

  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) {
    throw new Error('Invalid size format. Use format like "50MB", "1GB"');
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  return value * units[unit];
}

/**
 * Check if there's enough disk space available
 * @param {string} dirPath - Directory to check
 * @param {string} requiredSpace - Required space (e.g., "50MB")
 * @returns {Promise<Object>} Result with success status and details
 */
async function checkDiskSpace(dirPath, requiredSpace) {
  try {
    const availableBytes = await getAvailableDiskSpace(dirPath);
    const requiredBytes = parseSize(requiredSpace);
    
    return {
      success: availableBytes >= requiredBytes,
      availableBytes,
      requiredBytes,
      availableFormatted: formatBytes(availableBytes),
      requiredFormatted: formatBytes(requiredBytes),
      difference: availableBytes - requiredBytes
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      availableBytes: 0,
      requiredBytes: 0
    };
  }
}

/**
 * Recursively calculate the total size of a folder (in bytes)
 * @param {string} folderPath
 * @returns {number} Total size in bytes
 */
function getFolderSizeSync(folderPath) {
  let total = 0;
  if (!fs.existsSync(folderPath)) return 0;
  const files = fs.readdirSync(folderPath);
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      total += getFolderSizeSync(filePath);
    } else {
      total += stat.size;
    }
  }
  return total;
}

module.exports = {
  getAvailableDiskSpace,
  formatBytes,
  parseSize,
  checkDiskSpace,
  getFolderSizeSync,
}; 