const streamService = require('../../services/videostreaming/stream.service');
const hlsService = require('../../services/videostreaming/hls.service');
const { NotFoundError } = require('../../response/error.response');

// Stream HLS video with mode checking
exports.streamHLS = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    
    // Check current mode - if not streaming, return 503 for load balancer
    const currentMode = streamService.getMode();
    if (currentMode !== 'streaming') {
      console.log(`Server in ${currentMode} mode, returning 503 for video ${videoId}`);
      return res.status(503).json({ 
        error: 'Server temporarily unavailable',
        mode: currentMode,
        message: 'Server is currently in upload mode'
      });
    }
    
    // Server is in streaming mode, proceed with HLS streaming
    console.log(`Streaming HLS for video ${videoId} in ${currentMode} mode`);
    
    // Check if video has HLS files before proceeding
    const hasHLS = await hlsService.hasHLSFiles(videoId);
    if (!hasHLS) {
      console.log(`Video ${videoId} does not have HLS files`);
      throw new NotFoundError('Video does not have HLS support');
    }
    
    // Get and update the .m3u8 playlist
    const playlist = await hlsService.getUpdatedPlaylist(videoId);
    
    if (!playlist) {
      throw new NotFoundError('HLS playlist not found');
    }
    
    // Set appropriate headers for HLS streaming
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    
    // Return the updated playlist
    res.send(playlist);
    
  } catch (error) {
    next(error);
  }
};

// Serve HLS segments with mode checking
exports.serveSegment = async (req, res, next) => {
  try {
    const { videoId, segmentName } = req.params;
    
    // Check current mode - if not streaming, return 503 for load balancer
    const currentMode = streamService.getMode();
    if (currentMode !== 'streaming') {
      console.log(`Server in ${currentMode} mode, returning 503 for segment ${segmentName}`);
      return res.status(503).json({ 
        error: 'Server temporarily unavailable',
        mode: currentMode,
        message: 'Server is currently in upload mode'
      });
    }
    
    // Server is in streaming mode, proceed with segment serving
    console.log(`Serving segment ${segmentName} for video ${videoId} in ${currentMode} mode`);
    
    // Get segment file path
    const segmentPath = await hlsService.getSegmentPath(videoId, segmentName);
    
    if (!segmentPath) {
      throw new NotFoundError('Segment not found');
    }
    
    // Increment active streams counter
    streamService.incrementActiveStreams();
    
    // Set appropriate headers for video segment
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    
    // Serve the segment file
    res.sendFile(segmentPath, (err) => {
      if (err) {
        console.error('Error serving segment:', err);
      }
      // Always decrement active streams counter once
      streamService.decrementActiveStreams();
    });
    
  } catch (error) {
    streamService.decrementActiveStreams();
    next(error);
  }
}; 