const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Environment variables for streaming
const HLS_OUTPUT_DIR = process.env.HLS_OUTPUT_DIR || path.join(__dirname, '../../src/public/hls');
const DASH_OUTPUT_DIR = process.env.DASH_OUTPUT_DIR || path.join(__dirname, '../../src/public/dash');

/**
 * Generate HLS/DASH streaming chunks from video file
 * @param {string} inputPath - Path to input video file
 * @param {string} videoId - video ID for naming output directories
 * @returns {Promise<Object|null>} - Streaming info object or null if failed
 */
async function generateStreamingChunks(inputPath, videoId) {
  return new Promise((resolve) => {
    // Ensure output directories exist
    if (!fs.existsSync(HLS_OUTPUT_DIR)) {
      fs.mkdirSync(HLS_OUTPUT_DIR, { recursive: true });
    }
    if (!fs.existsSync(DASH_OUTPUT_DIR)) {
      fs.mkdirSync(DASH_OUTPUT_DIR, { recursive: true });
    }
    
    const hlsOutputDir = path.join(HLS_OUTPUT_DIR, videoId);
    const dashOutputDir = path.join(DASH_OUTPUT_DIR, videoId);

    // Ensure per-upload output directories exist
if (!fs.existsSync(hlsOutputDir)) {
  fs.mkdirSync(hlsOutputDir, { recursive: true });
}
if (!fs.existsSync(dashOutputDir)) {
  fs.mkdirSync(dashOutputDir, { recursive: true });
}
    
    // Generate HLS
    const ffmpegHLS = spawn('ffmpeg', [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-vf', 'scale=1280:720',
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_list_size', '0',
      '-hls_segment_filename', path.join(hlsOutputDir, 'segment_%03d.ts'),
      path.join(hlsOutputDir, 'playlist.m3u8')
    ]);
    
    ffmpegHLS.stderr.on('data', (data) => {
      console.log(`FFmpeg HLS: ${data}`);
    });
    
    ffmpegHLS.on('close', (code) => {
      if (code === 0) {
        resolve({
          hls: {
            playlistUrl: `/hls/${videoId}/playlist.m3u8`,
            directory: hlsOutputDir
          },
          dash: null // Could add DASH generation here if needed
        });
      } else {
        console.error(`FFmpeg HLS failed with code ${code}`);
        resolve(null);
      }
    });
  });
}

module.exports = generateStreamingChunks;