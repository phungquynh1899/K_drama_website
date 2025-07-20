const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const config = require('../../config/laptop-config');
const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');

/**
 * Send all chunks to Server B's /chunk endpoint, then notify /complete endpoint.
 * @param {string} uploadId
 * @param {string} serverBChunkUrl - relative path for /chunk endpoint (e.g. '/chunk')
 * @param {string} serverBCompleteUrl - relative path for /complete endpoint (e.g. '/complete')
 * @param {string} [filename] - optional, for /complete
 */
async function sendChunksToServerB(uploadId, userId, serverBChunkUrl, serverBCompleteUrl) {
    const tmpDir = path.join(__dirname, '../../public/uploads/tmp', String(uploadId));
    
    const baseDir = path.join(__dirname, '../../public/uploads/tmp');
    console.log(`Looking for directory: ${tmpDir}`);
    console.log(`__dirname: ${__dirname}`);
    console.log(`Base directory: ${baseDir}`);
    console.log(`Base directory exists: ${fs.existsSync(baseDir)}`);
    
    if (!fs.existsSync(tmpDir)) {
        throw new Error(`Upload directory not found for uploadId: ${uploadId}. Full path: ${tmpDir}`);
    }
    
    const files = fs.readdirSync(tmpDir);
    const chunks = files.filter(file => file.startsWith('chunk_')).sort((a, b) => {
        const aIndex = parseInt(a.replace('chunk_', ''));
        const bIndex = parseInt(b.replace('chunk_', ''));
        return aIndex - bIndex;
    });

    console.log(`Sending ${chunks.length} chunks to Server B for uploadId: ${uploadId}`);

    // 1. Send all chunks to /chunk endpoint
    for (let i = 0; i < chunks.length; i++) {
        const chunkFile = chunks[i];
        const chunkIndex = parseInt(chunkFile.replace('chunk_', ''));
        const chunkPath = path.join(tmpDir, chunkFile);
        
        // Create form data with chunk file and metadata
        const form = new FormData();
        form.append('chunk', fs.createReadStream(chunkPath));
        form.append('totalChunks', chunks.length);
        form.append('userId', userId);
        
        // Add uploadId to header for guaranteed access
        const headers = {
            ...form.getHeaders(),
            'X-Upload-ID': uploadId,
            'X-Chunk-Index': chunkIndex
        };

        const targetUrl = `http://localhost:3002/api/v1/upload${serverBChunkUrl}`;

        // Retry logic
        let attempt = 0;
        const maxAttempts = 3;
        let sent = false;
        let lastError = null;
        while (!sent && attempt < maxAttempts) {
            try {
                await axios.post(
                    targetUrl,
                    form,
                    {
                        headers: headers
                    }
                );
                console.log(`Successfully sent chunk ${chunkIndex} to Server B (${targetUrl}) on attempt ${attempt + 1}`);
                sent = true;
            } catch (error) {
                attempt++;
                lastError = error;
                console.error(`Failed to send chunk ${chunkIndex} to Server B (attempt ${attempt}):`, error.message);
                if (attempt < maxAttempts) {
                    // Exponential backoff: 1s, 2s, 4s
                    const delay = 1000 * Math.pow(2, attempt - 1);
                    console.log(`Retrying chunk ${chunkIndex} in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        if (!sent) {
            throw new Error(`Failed to send chunk ${chunkIndex} after ${maxAttempts} attempts: ${lastError.message}`);
        }
    }

    // Query filetype from the database
    const video = await BetterSqliteDatabase.getInstance().getVideoByUploadId(Number(uploadId));
    console.log("video:", video);
    if (!video) {
        throw new Error(`No video found for uploadId: ${uploadId}`);
    }
    const filetype = video.original_filetype;
    const filename = video.original_filename;

    // 2. After all chunks are sent, notify /complete endpoint
    const completeUrl = `http://localhost:3002/api/v1/upload${serverBCompleteUrl}`;
    try {
        const completeBody = {
            uploadId,
            totalChunks: chunks.length,
            userId,
            filename,
            filetype,
            videoId: video.id
        };
        await axios.post(completeUrl, completeBody, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`Successfully notified Server B /complete endpoint for uploadId: ${uploadId}`);
    } catch (error) {
        console.error(`Failed to notify Server B /complete endpoint:`, error.message);
        throw new Error(`Failed to notify /complete endpoint: ${error.message}`);
    }

    console.log(`All ${chunks.length} chunks sent and /complete notified for uploadId: ${uploadId}`);
}

module.exports = { sendChunksToServerB }