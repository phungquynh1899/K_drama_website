# Distributed Video Backup System: Implementation Guide

This document describes how to implement a robust backup system for video files (.m3u8, .ts) using BullMQ for coordination and HTTP endpoints for file transfer. It covers both the **Sender Server** (initiates backup) and **Receiver Server** (accepts backup).

---

## 1. Overview
- **Sender Server**: Detects when a backup is needed, pushes a job to BullMQ, and uploads files to the receiver.
- **Receiver Server**: Listens for BullMQ jobs, checks disk space, notifies sender when ready, and accepts file uploads.
- **File transfer** is done via HTTP endpoints, with file-level retry logic.

---

## 2. BullMQ Job Structure

When a backup is needed, the sender pushes a job to BullMQ with the following data:

```json
{
  "requireEmptyDiskSpace": "50MB",
  "videoId": 2,
  "linkToNoticeThatYouAreReadyToReceiveBackup": "http://SENDER_HOST/api/v1/backup/readyForBackup"
}
```

---

## 3. Receiver Server Logic

### 3.1. BullMQ Worker
- Listens for jobs on the `backup` queue.
- Checks if there is enough free disk space.
- If ready, notifies the sender via the provided link, including:
  - `videoId`
  - `linkToReceive`: Where the sender should upload files (e.g., `http://RECEIVER_HOST/api/v1/backup/receive`)
  - `linkToNoticeThatBackupComplete`: Where the sender should notify when upload is done (e.g., `http://RECEIVER_HOST/api/v1/backup/complete`)

**Example notification payload:**
```json
{
  "videoId": 2,
  "linkToReceive": "http://RECEIVER_HOST/api/v1/backup/receive",
  "linkToNoticeThatBackupComplete": "http://RECEIVER_HOST/api/v1/backup/complete"
}
```

### 3.2. HTTP Endpoints
- `POST /api/v1/backup/receive` — Accepts file uploads (one file per request, or batch if desired).
- `POST /api/v1/backup/complete` — Sender calls this after all files are uploaded. Receiver checks if all expected files are present and responds with OK or a list of missing files.

### 3.3. File Tracking
- Optionally, keep a manifest (list) of expected files for each videoId.
- Mark files as received as they arrive.
- On `/complete`, compare received files to expected list.

---

## 4. Sender Server Logic

### 4.1. Push Job to BullMQ
- When backup is needed, push a job as described above.

### 4.2. Wait for Notification
- Wait for the receiver to call your `linkToNoticeThatYouAreReadyToReceiveBackup` endpoint.
- The notification will include the upload and completion URLs.

### 4.3. Upload Files
- For each file (.m3u8, .ts):
  - Upload to `linkToReceive` (e.g., via HTTP POST, one file at a time).
  - If upload fails, retry that file a few times before giving up.
- After all files are uploaded, call `linkToNoticeThatBackupComplete`.
- If the response lists missing files, retry uploading just those files, then call `/complete` again.

### 4.4. File Upload Example (Pseudocode)
```js
for (const file of files) {
  let success = false;
  for (let attempt = 0; attempt < MAX_RETRIES && !success; attempt++) {
    try {
      await uploadFile(linkToReceive, file);
      success = true;
    } catch (err) {
      // wait and retry
    }
  }
  if (!success) throw new Error(`Failed to upload ${file.name}`);
}
// After all files:
await notifyComplete(linkToNoticeThatBackupComplete, videoId);
```

---

## 5. Error Handling & Retries
- **File upload retries**: Handled by the sender, per file.
- **BullMQ job retries**: Only if the receiver cannot prepare for backup (e.g., not enough disk space).
- **/complete endpoint**: Helps sender know if any files are missing and need to be retried.

---

## 6. Security & Robustness
- Authenticate/authorize all endpoints.
- Validate all inputs (videoId, file names, etc.).
- Clean up incomplete uploads after a timeout or repeated failures.

---

## 7. Example Sequence Diagram

1. Sender pushes job to BullMQ.
2. Receiver gets job, checks disk, notifies sender with upload URLs.
3. Sender uploads files (with retries).
4. Sender calls `/complete`.
5. Receiver checks files, responds with OK or missing files.
6. Sender retries missing files if needed, then calls `/complete` again.

---

## 8. References
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Node.js HTTP File Upload Example](https://expressjs.com/en/resources/middleware/multer.html)
- [check-disk-space npm package](https://www.npmjs.com/package/check-disk-space)

---

**This guide should be sufficient for any developer to implement the sender and receiver logic for a robust, distributed video backup system.** 