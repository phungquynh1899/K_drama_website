const { spawn } = require('child_process');

/**
 * Scan a video file for viruses using ClamAV
 * @param {string} filePath - Path to the file to scan
 * @returns {Promise<Object>} - Result object with isClean boolean and details
 */
async function scanVideoWithClamAV(filePath) {
  return new Promise((resolve) => {
    const clamscan = spawn('clamscan', ['--no-summary', '--infected', filePath]);
    
    let output = '';
    clamscan.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    clamscan.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    clamscan.on('close', (code) => {
      // ClamAV returns 0 for clean, 1 for infected, 2 for error
      if (code === 0) {
        resolve({ isClean: true, details: 'No threats detected' });
      } else if (code === 1) {
        resolve({ isClean: false, details: output });
      } else {
        resolve({ isClean: false, details: `ClamAV error: ${output}` });
      }
    });
  });
}

module.exports = scanVideoWithClamAV;