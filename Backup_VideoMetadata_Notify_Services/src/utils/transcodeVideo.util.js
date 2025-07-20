const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Environment variables for transcoding
const TRANSCODED_VIDEOS_DIR = process.env.TRANSCODED_VIDEOS_DIR || path.join(__dirname, '../../src/public/transcoded');

/**
 * Transcode video to 720p using FFmpeg
 * @param {string} inputPath - Path to input video file
 * @param {string} uploadId - Upload ID for naming output file
 * @returns {Promise<string|null>} - Path to transcoded file or null if failed
 */
async function transcodeVideoTo720p(inputPath, uploadId) {
  return new Promise((resolve) => {
    // Ensure output directory exists
    if (!fs.existsSync(TRANSCODED_VIDEOS_DIR)) {
      fs.mkdirSync(TRANSCODED_VIDEOS_DIR, { recursive: true });
    }
    
    const outputPath = path.join(TRANSCODED_VIDEOS_DIR, `${uploadId}_720p.mp4`);
    
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-vf', 'scale=1280:720',
      '-movflags', '+faststart',
      outputPath
    ]);
    
    ffmpeg.stderr.on('data', (data) => {
      console.log(`FFmpeg: ${data}`);
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        console.error(`FFmpeg failed with code ${code}`);
        resolve(null);
      }
    });
  });
}

module.exports = transcodeVideoTo720p;