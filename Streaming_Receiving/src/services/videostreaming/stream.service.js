const fs = require('fs');
const path = require('path');
const cluster = require('cluster');
const os = require('os');

// Track active streams (for status)
let activeStreams = 0;
let waitingForStreamsToFinish = false;
let notifyReadyCallback = null;
let currentMode = 'streaming'; // 'streaming' | 'waiting-for-upload' | 'uploading'

exports.getMode = () => currentMode;
exports.setMode = (mode) => { currentMode = mode; };

// Active streams tracking functions
exports.getActiveStreams = () => activeStreams;
exports.incrementActiveStreams = () => { activeStreams++; };
exports.decrementActiveStreams = () => { 
  activeStreams--; 
  checkIfReadyToNotify();
};

// Stream a specific chunk to the user
exports.streamChunk = async (uploadId, chunkIndex, req, res) => {
  try {
    if (currentMode !== 'streaming') {
      res.status(423).json({ error: 'Server is not in streaming mode' });
      return;
    }
    const chunkPath = path.join(__dirname, '../../public/uploads/tmp', uploadId, `chunk_${chunkIndex}`);
    if (!fs.existsSync(chunkPath)) {
      res.status(404).json({ error: 'Chunk not found' });
      return;
    }
    activeStreams++;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=chunk_${chunkIndex}`);
    const readStream = fs.createReadStream(chunkPath);
    readStream.pipe(res);
    readStream.on('close', () => {
      activeStreams--;
      checkIfReadyToNotify();
    });
    readStream.on('error', (err) => {
      activeStreams--;
      checkIfReadyToNotify();
      res.status(500).json({ error: 'Error streaming chunk', details: err.message });
    });
  } catch (error) {
    activeStreams--;
    res.status(500).json({ error: error.message });
  }
};

function checkIfReadyToNotify() {
  if (currentMode === 'waiting-for-upload' && waitingForStreamsToFinish && activeStreams === 0 && notifyReadyCallback) {
    waitingForStreamsToFinish = false;
    currentMode = 'uploading';
    notifyReadyCallback();
  }
}

//chủ yếu là gán hàm notifyFn 
exports.waitForStreamsThenNotify = (notifyFn) => {
  waitingForStreamsToFinish = true;
  notifyReadyCallback = notifyFn;
  currentMode = 'waiting-for-upload';
  if (activeStreams === 0) {
    waitingForStreamsToFinish = false;
    currentMode = 'uploading';
    notifyReadyCallback();
  }
};

// Get current streaming status
exports.getStreamingStatus = () => {
  return {
    activeStreams,
    workers: cluster.isMaster ? Object.keys(cluster.workers).length : 1,
    isMaster: cluster.isMaster,
    pid: process.pid,
    currentMode
  };
};

// Stop all streaming workers (for mode switch)
exports.stopAllStreamingWorkers = async () => {
  if (cluster.isMaster) {
    for (const id in cluster.workers) {
      cluster.workers[id].kill('SIGTERM');
    }
  } else {
    process.exit(0);
  }
}; 