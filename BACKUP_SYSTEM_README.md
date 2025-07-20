# Backup System Documentation

## Overview

This backup system allows Server B to send video backups to Server A through a coordinated process. The system includes disk space checking, request queuing, and automatic notification mechanisms.

## Architecture

- **Server A**: The receiving server (this server) that can accept backups from other servers
- **Server B**: The sending server that wants to backup videos to Server A

## API Endpoints

### 1. Check if Server A can accept backup
**Endpoint:** `POST /api/v1/backup/can-accept-backup`

**Request Body:**
```json
{
  "videoId": 2,
  "diskEmptySpaceRequire": "50MB",
  "linkForServerAtoNoticeServerBWhenServerAIsReady": "http://localhost:3002/api/v1/backup/serverAisReadyForBackup"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Server A can accept backup",
  "availableSpace": "1.5 GB",
  "requiredSpace": "50 MB"
}
```

### 2. Server A notifies Server B that it's ready
**Endpoint:** `POST /api/v1/backup/serverAisReadyForBackup`

**Request Body:**
```json
{
  "videoId": 2,
  "linkForServerBtoSendBackupToSeverA": "http://localhost:3000/api/v1/backup/receive-backup",
  "linkForServerBtoCompleteBackupToSeverA": "http://localhost:3000/api/v1/backup/complete-backup"
}
```

### 3. Receive backup from Server B
**Endpoint:** `POST /api/v1/backup/receive-backup`

**Request Body:**
```json
{
  "videoId": 2
}
```

### 4. Complete backup process
**Endpoint:** `POST /api/v1/backup/complete-backup`

**Request Body:**
```json
{
  "videoId": 2,
  "success": true
}
```

## How It Works

### Step 1: Initial Request
1. Server B sends a request to Server A asking if it can accept a backup
2. Server A checks available disk space
3. If sufficient space is available, Server A stores the request in `backupRequests` Map
4. Server A responds with success/failure

### Step 2: Automatic Notification
1. Server A continuously monitors `backupRequests` every 5 seconds
2. When a request is found, Server A automatically sends a notification to Server B
3. The notification includes endpoints for Server B to send the backup

### Step 3: Backup Transfer
1. Server B receives the notification and sends the backup to Server A
2. Server A processes the backup and stores it
3. Server B completes the process by calling the completion endpoint

## Key Features

### Continuous Monitoring
- Uses `setInterval` to check for pending backup requests every 5 seconds
- Automatically processes requests without manual intervention

### Disk Space Management
- Checks available disk space before accepting backups
- Supports various size formats (B, KB, MB, GB)
- Returns human-readable space information

### Request Tracking
- `backupRequests`: Stores pending requests waiting to be processed
- `backupInProgress`: Tracks active backup operations

### Error Handling
- Comprehensive error handling for all endpoints
- Graceful failure responses with meaningful messages
- Logging for debugging and monitoring

## Usage Example

```javascript
// Server B asking Server A if it can accept backup
const response = await axios.post('http://localhost:3000/api/v1/backup/can-accept-backup', {
  videoId: 2,
  diskEmptySpaceRequire: '50MB',
  linkForServerAtoNoticeServerBWhenServerAIsReady: 'http://localhost:3002/api/v1/backup/serverAisReadyForBackup'
});

if (response.data.success) {
  console.log('Backup request accepted!');
  // Server A will automatically notify Server B when ready
}
```

## Testing

Run the test script to see the backup system in action:

```bash
node test-backup-system.js
```

## Environment Variables

- `HOST`: Server host (default: localhost:3000)
- `PROTOCOL`: Server protocol (default: http)

## File Structure

```
src/
├── controllers/
│   └── backup/
│       └── backup.controller.js    # Main backup logic
├── routes/
│   └── backup/
│       └── backup.router.js        # API endpoints
└── app.js                          # Main application file
```

## Notes

- The system uses `setInterval` instead of event listeners for continuous monitoring
- Disk space checking uses Node.js `fs.statfs` function
- All backup requests are stored in memory (Map objects)
- The system automatically cleans up completed backups 