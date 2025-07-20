const fs = require('fs');
const path = require('path');

class HLSService {
  constructor() {
    this.hlsBasePath = path.join(__dirname, '../../public/hls');
  }

  // Get updated HLS playlist with proper segment URLs
  async getUpdatedPlaylist(videoId) {
    try {
      const playlistPath = path.join(this.hlsBasePath, videoId, 'playlist.m3u8');
      
      if (!fs.existsSync(playlistPath)) {
        console.log(`Playlist not found: ${playlistPath}`);
        return null;
      }

      // Read the original playlist
      let playlist = fs.readFileSync(playlistPath, 'utf8');
      
      // Update segment URLs to use our streaming endpoints
      playlist = playlist.replace(/segment_(\d+)\.ts/g, `/api/v1/stream/hls/${videoId}/segment/segment_$1.ts`);
      
      console.log(`Updated playlist for video ${videoId} with streaming URLs`);
      return playlist;
      
    } catch (error) {
      console.error('Error reading/updating playlist:', error);
      return null;
    }
  }

  // Get segment file path
  async getSegmentPath(videoId, segmentName) {
    try {
      const segmentPath = path.join(this.hlsBasePath, videoId, segmentName);
      
      if (!fs.existsSync(segmentPath)) {
        console.log(`Segment not found: ${segmentPath}`);
        return null;
      }

      return segmentPath;
    } catch (error) {
      console.error('Error getting segment path:', error);
      return null;
    }
  }

  // Check if video has HLS files
  async hasHLSFiles(videoId) {
    try {
      const hlsPath = path.join(this.hlsBasePath, videoId.toString());
      const playlistPath = path.join(hlsPath, 'playlist.m3u8');
      return fs.existsSync(hlsPath) && fs.existsSync(playlistPath);
    } catch (error) {
      console.error('Error checking HLS files:', error);
      return false;
    }
  }

  // List available videos with HLS support
  async listVideosWithHLS() {
    try {
      const videos = [];
      
      if (!fs.existsSync(this.hlsBasePath)) {
        return videos;
      }

      const videoDirs = fs.readdirSync(this.hlsBasePath);
      
      for (const videoId of videoDirs) {
        const hlsPath = path.join(this.hlsBasePath, videoId);
        const playlistPath = path.join(hlsPath, 'playlist.m3u8');
        
        if (fs.existsSync(playlistPath)) {
          videos.push({
            id: videoId,
            hlsUrl: `/api/v1/stream/hls/${videoId}`,
            hasPlaylist: true
          });
        }
      }
      
      return videos;
    } catch (error) {
      console.error('Error listing videos with HLS:', error);
      return [];
    }
  }
}

module.exports = new HLSService(); 