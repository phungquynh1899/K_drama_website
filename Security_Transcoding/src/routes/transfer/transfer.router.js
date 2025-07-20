const express = require('express')
const asyncHandler = require('../../utils/asyncHandler.util')
const router = express.Router()
const { sendChunksToServerB } = require('../../services/transfer/transfer.service')

// Endpoint for Server B to notify when ready to receive chunks
router.post('/TransferFileFromServerAtoServerB', async (req, res, next) => {
    try {
        const { uploadId, userId, serverB_chunk_URL, serverB_complete_URL } = req.body;
        
        if (!uploadId || !userId || !serverB_chunk_URL || !serverB_complete_URL) {
            return res.status(400).json({ 
                error: 'Missing required fields: uploadId, serverB_chunk_URL, serverB_complete_URL' 
            });
        }

        console.log(`Server B is ready to receive chunks for uploadId: ${uploadId}`);
        
        // Send all chunks to Server B
        await sendChunksToServerB(uploadId, userId, serverB_chunk_URL, serverB_complete_URL);

        res.status(200).json({
            message: 'Chunks sent to Server B successfully',
            uploadId,
            status: 'chunks_sent_to_server_b'
        });
        
    } catch (error) {
        console.error('Error sending chunks to Server B:', error);
        res.status(500).json({
            error: 'Failed to send chunks to Server B',
            message: error.message
        });
    }
});

module.exports = router