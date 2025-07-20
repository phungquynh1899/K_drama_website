const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SERVER_D_URL = process.env.SERVER_D_URL;
const SERVER_A_URL = process.env.SERVER_A_URL;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;

exports.handleTransferWorkflow = async ({ folderPath, userEmail, userId, videoId, chunkList }) => {
  // 1. Ask Server D if ready
  // (Assume always yes for now)
  // 2. Transfer files to Server D (HTTP upload)
  // 3. Update metadata on Server A
  // 4. Send email to user
  // 5. Return status
  try {
    // 1. Ask Server D if ready
    // (Mocked as always yes)
    // const readyRes = await fetch(`${SERVER_D_URL}/api/v1/ready`, { method: 'GET' });
    // const ready = await readyRes.json();
    const ready = { ready: true };
    if (!ready.ready) {
      return { status: 503, message: 'Server D not ready' };
    }

    // 2. Transfer files to Server D (simulate HTTP upload for each chunk)
    for (const chunk of chunkList) {
      const chunkPath = path.join(folderPath, chunk);
      const stat = fs.statSync(chunkPath);
      const fileStream = fs.createReadStream(chunkPath);
      const uploadRes = await fetch(`${SERVER_D_URL}/api/v1/upload-chunk`, {
        method: 'POST',
        headers: {
          'Content-Length': stat.size,
          'Content-Type': 'application/octet-stream',
          'X-Chunk-Name': chunk,
          'X-Video-Id': videoId,
        },
        body: fileStream,
      });
      if (!uploadRes.ok) {
        return { status: 500, message: `Failed to upload chunk ${chunk} to Server D` };
      }
    }

    // 3. Update metadata on Server A
    const metadataRes = await fetch(`${SERVER_A_URL}/api/v1/videometadata/update-chunks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, chunkList, serverDPath: `/videos/${videoId}/` }),
    });
    if (!metadataRes.ok) {
      return { status: 500, message: 'Failed to update metadata on Server A' };
    }

    // 4. Send email to user
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS,
      },
    });
    await transporter.sendMail({
      from: GMAIL_USER,
      to: userEmail,
      subject: 'Your video is ready!',
      text: `Your video (ID: ${videoId}) is now available for streaming.`,
    });

    return { status: 200, message: 'Transfer complete, metadata updated, email sent.' };
  } catch (err) {
    return { status: 500, message: 'Error in transfer workflow', error: err.message };
  }
}; 