const streamService = require('../../services/videostreaming/stream.service')
const cluster = require('cluster');
const axios = require('axios');

// Stream a specific chunk to the user
exports.streamChunk = async (req, res, next) => {
  try {
    const { uploadId, chunkIndex } = req.params;
    await streamService.streamChunk(uploadId, chunkIndex, req, res);
  } catch (error) {
    next(error);
  }
};

// Get current streaming status (number of active streams/workers)
exports.getStreamingStatus = (req, res) => {
  const status = streamService.getStreamingStatus();
  res.json(status);
};

// Gracefully stop all streaming workers (for mode switch)
exports.stopAllStreamingWorkers = async (req, res) => {
  try {
    await streamService.stopAllStreamingWorkers();
    res.json({ message: 'All streaming workers stopped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}; 