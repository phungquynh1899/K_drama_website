const fs = require('fs');
const path = require('path');

const BACKUP_ROOT = process.env.BACKUP_ROOT || path.join(__dirname, '../../public/hls');
const MANIFEST_NAME = 'manifest.json';

function getVideoDir(videoId) {
  return path.join(BACKUP_ROOT, videoId.toString());
}

function getManifestPath(videoId) {
  return path.join(getVideoDir(videoId), MANIFEST_NAME);
}

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

exports.receiveFile = (req, res, next) => {
  const videoId = req.headers['videoid'];
  const filename = req.headers['filename'];
  if (!videoId || !filename) {
    return res.status(400).json({ status: 'failed', message: 'Missing videoid or filename in headers' });
  }

  // Validate file type
  const allowedExtensions = ['.m3u8', '.ts'];
  const ext = path.extname(filename).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return res.status(400).json({ status: 'failed', message: 'Invalid file type', filename });
  }

  try {
    const videoDir = getVideoDir(videoId);
    ensureDirSync(videoDir);
    const filePath = path.join(videoDir, filename);

    // Save the stream to disk
    const writeStream = fs.createWriteStream(filePath);
    req.pipe(writeStream);

    writeStream.on('finish', () => {
      // Track file in manifest
      const manifestPath = getManifestPath(videoId);
      let manifest = { received: [] };
      if (fs.existsSync(manifestPath)) {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      }
      if (!manifest.received.includes(filename)) {
        manifest.received.push(filename);
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      }
      res.status(201).json({ status: 'success', message: 'File uploaded', filename });
    });

    writeStream.on('error', (err) => {
      res.status(500).json({ status: 'failed', message: 'Failed to save file', filename, details: err.message });
    });
  } catch (err) {
    res.status(500).json({ status: 'failed', message: 'Failed to save file', filename, details: err.message });
  }
};

exports.completeBackup = (req, res, next) => {
  const { videoId, status, message, uploadedFiles } = req.body;
  
  // Validate required fields
  if (!videoId) {
    return res.status(400).json({ 
      status: 'failed', 
      message: 'Missing videoId in request body' 
    });
  }

  try {
    const manifestPath = getManifestPath(videoId);
    let manifest = { 
      received: [],
      completed: false,
      completedAt: null,
      status: null,
      message: null,
      uploadedFiles: []
    };

    // Load existing manifest if it exists
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }

    // Update manifest with completion data
    manifest.completed = true;
    manifest.completedAt = new Date().toISOString();
    manifest.status = status || 'completed';
    manifest.message = message || 'Backup completed successfully';
    
    // Update uploaded files if provided
    if (uploadedFiles && Array.isArray(uploadedFiles)) {
      manifest.uploadedFiles = uploadedFiles;
    }

    // Save updated manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    res.status(200).json({
      status: 'success',
      message: 'Backup completion recorded successfully',
      videoId,
      completedAt: manifest.completedAt,
      status: manifest.status,
      message: manifest.message,
      uploadedFiles: manifest.uploadedFiles
    });

  } catch (err) {
    console.error('Error completing backup:', err);
    res.status(500).json({
      status: 'failed',
      message: 'Failed to complete backup',
      videoId,
      details: err.message
    });
  }
};

exports.getBackupStatus = (req, res, next) => {
  const { videoId } = req.params;
  const manifestPath = getManifestPath(videoId);
  let manifest = { received: [] };
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }
  res.json({ received: manifest.received });
}; 

exports.cancelJob = (req, res, next) => {
  const { videoId, reason, error, failedFiles, uploadedFiles } = req.body;
  
  // Validate required fields
  if (!videoId) {
    return res.status(400).json({ 
      status: 'failed', 
      message: 'Missing videoId in request body' 
    });
  }

  try {
    const videoDir = getVideoDir(videoId);
    const manifestPath = getManifestPath(videoId);
    
    // Check if the video directory exists
    if (!fs.existsSync(videoDir)) {
      return res.status(404).json({
        status: 'failed',
        message: 'Video backup directory not found',
        videoId
      });
    }

    // Read manifest to get list of files before deletion
    let manifest = { received: [] };
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }

    // Delete all files in the video directory
    const filesToDelete = fs.readdirSync(videoDir);
    const deletedFiles = [];
    
    for (const file of filesToDelete) {
      const filePath = path.join(videoDir, file);
      try {
        fs.unlinkSync(filePath);
        deletedFiles.push(file);
      } catch (err) {
        console.error(`Failed to delete file ${file}:`, err.message);
      }
    }

    // Remove the video directory itself
    try {
      fs.rmdirSync(videoDir);
    } catch (err) {
      console.error(`Failed to remove directory ${videoDir}:`, err.message);
    }

    // Log cancellation details
    const cancellationLog = {
      videoId,
      cancelledAt: new Date().toISOString(),
      reason: reason || 'Job cancelled by sender',
      error: error || 'No specific error provided',
      failedFiles: failedFiles || [],
      uploadedFiles: uploadedFiles || [],
      deletedFiles,
      originalReceivedFiles: manifest.received || []
    };

    console.log('Job cancelled:', cancellationLog);

    res.status(200).json({
      status: 'success',
      message: 'Job cancelled and files cleaned up successfully',
      videoId,
      cancelledAt: cancellationLog.cancelledAt,
      deletedFiles,
      reason: cancellationLog.reason,
      error: cancellationLog.error
    });

  } catch (err) {
    console.error('Error cancelling job:', err);
    res.status(500).json({
      status: 'failed',
      message: 'Failed to cancel job and clean up files',
      videoId,
      details: err.message
    });
  }
}; 