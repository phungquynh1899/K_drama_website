# Functional Requirements Document: K-Drama Streaming Website

---

## 1. User Interface (Website)
- **Purpose:** Provide a user-friendly platform for browsing, searching, uploading, and streaming K-drama episodes.
- **Inputs:** User actions (clicks, searches, uploads, play requests), authentication tokens.
- **Outputs:** Web pages, video streams, error messages, notifications.
- **Actions:**
  - Display homepage with featured series/episodes.
  - Allow users to search, filter, and browse series/episodes.
  - Provide video player for streaming.
  - Show upload form for authorized users.
  - Display user profile, watch history, and favorites.
- **Edge Cases:**
  - Handle slow or lost network connections.
  - Display errors for unavailable content.
- **Security/Performance:**
  - Use HTTPS for all communications.
  - Sanitize all user inputs.

---

## 2. Authentication & Authorization
- **Purpose:** Secure access to uploading, streaming, and admin features.
- **Inputs:** User credentials (login/register), authentication tokens.
- **Outputs:** Auth tokens, access granted/denied messages.
- **Actions:**
  - Register new users.
  - Authenticate users on login.
  - Issue and validate JWT tokens.
  - Enforce role-based access (user, admin, uploader).
- **Edge Cases:**
  - Expired or invalid tokens.
  - Multiple failed login attempts (lockout or CAPTCHA).
- **Security/Performance:**
  - Hash and salt passwords.
  - Rate-limit login attempts.

---

## 3. Video Upload Service
- **Purpose:** Allow authorized users to upload large video files reliably and efficiently using chunked uploads.
- **Inputs:** Video file (split into chunks), metadata (title, episode, series, description), user token.
- **Outputs:** Confirmation of upload, error messages, file reassembled in temporary storage.
- **Actions:**
  1. Split video file into fixed-size chunks on the client or upload proxy.
  2. Upload each chunk to one or more servers in the mini data center (can be parallelized).
  3. Each server verifies chunk integrity using a checksum (e.g., MD5, SHA-256).
  4. Track which chunks have arrived (using a manifest or database).
  5. Once all chunks are received and verified, combine them into the original video file locally in the mini data center.
  6. Perform a final checksum on the reassembled file to ensure integrity.
  7. Send the combined video file to Google Cloud for transcoding (if available), or transcode locally as a fallback.
  8. Notify the transcoding service to begin processing.
- **Edge Cases:**
  - Missing or corrupted chunks (request re-upload).
  - Duplicate chunk uploads (ignore or replace).
  - Network interruptions (support resume).
- **Security/Performance:**
  - Only allow authenticated users.
  - Limit chunk size and rate per user.
  - Sanitize metadata.
  - Use HTTPS for all transfers.
  - Ensure enough local storage for reassembly.

> **Note:** This approach is chosen for simplicity, reliability, and to fit the hardware and free cloud tier constraints. If scaling up in the future, consider direct-to-cloud chunked uploads.

---

## 4. Transcoding Service
- **Purpose:** Convert uploaded videos to streaming-friendly formats and resolutions.
- **Inputs:** Video file from upload service.
- **Outputs:** Transcoded video files (multiple resolutions), error logs.
- **Actions:**
  - Send job to Google Cloud transcoder (primary).
  - If Google Cloud fails, use local laptop transcoder (fallback).
  - Store transcoded files in storage (Wasabi, iDrive).
  - Notify upload service of completion/failure.
- **Edge Cases:**
  - Retry failed jobs.
  - Notify admin on repeated failures.
- **Security/Performance:**
  - Isolate transcoding environment.
  - Monitor resource usage.

---

## 5. Load Balancer
- **Purpose:** Distribute incoming requests to available backend servers.
- **Inputs:** User requests (upload, stream, metadata).
- **Outputs:** Forwarded requests to backend services.
- **Actions:**
  - Route requests to least-loaded/healthy server.
  - Detect server health and reroute if down.
- **Edge Cases:**
  - Server failures.
  - Overloaded servers.
- **Security/Performance:**
  - Prevent DDoS attacks (rate limiting, IP blocking).

---

## 6. CDN (Content Delivery Network)
- **Purpose:** Deliver video content and static assets to users with low latency.
- **Inputs:** Requests for video segments or static files.
- **Outputs:** Cached video segments, static files.
- **Actions:**
  - Cache and serve video content close to users.
  - Invalidate cache on new uploads or updates.
- **Edge Cases:**
  - Cache misses (fetch from origin).
  - Stale content.
- **Security/Performance:**
  - Enforce HTTPS.
  - Restrict access to authorized users.

---

## 7. Caching Layer
- **Purpose:**  
  Speed up video streaming and metadata retrieval by using Redis for metadata and the old PC's SSD for video segment caching (hybrid cache).

- **Inputs:**  
  - Requests for video metadata (title, episode info, etc.)
  - Requests for video segments (e.g., .ts files for HLS, .mp4 chunks, etc.)

- **Outputs:**  
  - Cached metadata from Redis (if present)
  - Cached video segments from SSD (if present)
  - Cache miss (triggers fetch from storage or database)

- **Actions:**  
  1. Store video metadata (titles, episode info, etc.) in Redis for fast, in-memory access.
  2. Store video segments on the SSD, organized for quick retrieval (e.g., by series/episode/segment).
  3. On user request:
     - Check Redis for metadata; if present, serve immediately.
     - Check SSD for video segment; if present, serve immediately.
     - If not present in cache, fetch from primary storage (Wasabi/iDrive), serve to user, and cache on SSD for future requests.
  4. Use LRU (Least Recently Used) or similar policy to evict old video segments from SSD when space is low.
  5. Periodically back up Redis and monitor SSD health.

- **Edge Cases:**  
  - SSD full: Evict old video segments to free up space.
  - Redis process crash: Recover metadata from backup.
  - Cache corruption: Detect and rebuild cache as needed.

- **Security/Performance:**  
  - Restrict Redis access to trusted services only (bind to localhost or use authentication).
  - Secure SSD cache directory from unauthorized access.
  - Use HTTPS for all data transfers between cache and other services.
  - Monitor SSD health and performance.
  - Tune Redis memory usage to fit the old PC's hardware limits.

---

## 8. Streaming Service
- **Purpose:** Deliver video streams to users in adaptive bitrate formats.
- **Inputs:** User requests for specific episodes.
- **Outputs:** Video stream (HLS/DASH), error messages.
- **Actions:**
  - Check cache for requested video.
  - If not cached, fetch from storage.
  - Serve video in adaptive bitrate.
- **Edge Cases:**
  - Handle slow network (lower quality).
  - Handle missing files (show error).
- **Security/Performance:**
  - Enforce access control.
  - Monitor streaming quality and errors.

---

## 9. Video Metadata Service
- **Purpose:** Store and retrieve information about videos (title, description, series, episode, etc.).
- **Inputs:** Metadata from upload, queries from frontend.
- **Outputs:** Metadata for display, search results.
- **Actions:**
  - Save metadata on upload.
  - Allow search/filter by series, episode, etc.
  - Update metadata if needed.
- **Edge Cases:**
  - Inconsistent or missing metadata.
- **Security/Performance:**
  - Validate and sanitize all metadata.

---

## 10. Storage (Wasabi, iDrive)
- **Purpose:** Store original and transcoded videos with redundancy.
- **Inputs:** Video files from transcoding service.
- **Outputs:** Files for streaming or download.
- **Actions:**
  - Store 3 copies on Wasabi, 3 on iDrive.
  - Verify integrity of stored files.
  - Retrieve files for streaming or download.
- **Edge Cases:**
  - Storage provider outages.
  - File corruption.
- **Security/Performance:**
  - Encrypt files at rest.
  - Restrict access to storage APIs.

---

## 11. Fallback / Retry Logic
- **Purpose:**  
  Ensure high availability by automatically switching to backup services and retrying failed jobs if the primary service (e.g., Google Cloud) is unavailable.

- **Inputs:**  
  - Job status (success, failure, timeout)
  - Error messages from services (e.g., Google Cloud)

- **Outputs:**  
  - Job rerouted to backup service (e.g., local laptop)
  - Retry logs and notifications

- **Actions:**  
  1. When a job (like transcoding) is submitted, send it to the primary service (Google Cloud).
  2. If the job fails (e.g., error, timeout, no response), automatically reroute the job to the backup service (local laptop in the mini data center).
  3. Log the failure and the fallback action for monitoring and auditing.
  4. Periodically check if the primary service is available again.
  5. When the primary service is back, resume sending new jobs to it.
  6. Optionally, retry failed jobs on the primary service if they were only processed by the backup.

- **Edge Cases:**  
  - Both primary and backup services are down: Notify admin, queue jobs for later retry.
  - Repeated failures: Alert admin, escalate issue.
  - Avoid infinite retry loops by setting a maximum number of retries per job.

- **Security/Performance:**  
  - Log all fallback and retry events for auditing and troubleshooting.
  - Ensure only authorized systems can reroute or retry jobs.

- **Summary:**  
  Fallback/retry logic means your system will automatically try a backup option if the main service fails, and will keep retrying failed jobs up to a safe limit. This keeps your service reliable and available, even if something goes wrong with your main provider.

- **Example Flow:**

```
[Upload Complete]
      |
      v
[Send to Google Cloud for Transcoding]
      |
   [Success]--------------------> [Done]
      |
   [Failure]
      v
[Send to Local Laptop for Transcoding]
      |
   [Success]--------------------> [Done]
      |
   [Failure]
      v
[Log Error, Notify Admin, Retry Later]
```

---

## 12. Security
- **Purpose:** Protect system and user data from threats.
- **Actions:**
  - Validate all user inputs.
  - Use HTTPS everywhere.
  - Limit upload rates to prevent abuse.
  - Log suspicious activity.
  - Scan uploads for malware.
  - Enforce access control on all APIs.
- **Edge Cases:**
  - Attempted attacks (XSS, SQL injection, etc.).
- **Security/Performance:**
  - Regular security audits.

---

## 13. Monitoring & Logging
- **Purpose:** Track system health, usage, and errors.
- **Actions:**
  - Log all uploads, streams, errors, and admin actions.
  - Alert on failures or unusual activity.
  - Provide dashboards for system metrics.
- **Edge Cases:**
  - Log storage full.
- **Security/Performance:**
  - Protect logs from unauthorized access.

---

## 14. Admin Dashboard
- **Purpose:** Allow admins to manage content, users, and monitor system health.
- **Inputs:** Admin actions (add/remove content, ban users, view logs).
- **Outputs:** Management interfaces, reports, alerts.
- **Actions:**
  - Add/edit/delete series, episodes, and metadata.
  - Manage user accounts and permissions.
  - View system logs and analytics.
- **Edge Cases:**
  - Unauthorized access attempts.
- **Security/Performance:**
  - Restrict access to admins only.

---

## 15. Search & Discovery
- **Purpose:** Help users find series and episodes easily.
- **Inputs:** Search queries, filters.
- **Outputs:** Search results, recommendations.
- **Actions:**
  - Search by title, genre, actor, etc.
  - Filter by series, episode, popularity.
  - Provide recommendations based on user activity.
- **Edge Cases:**
  - No results found.
- **Security/Performance:**
  - Sanitize search inputs.

---

## 16. Analytics
- **Purpose:** Track and analyze user engagement and content popularity.
- **Inputs:** User activity data.
- **Outputs:** Analytics dashboards, reports.
- **Actions:**
  - Track views, watch time, popular episodes.
  - Generate reports for admins.
- **Edge Cases:**
  - Data loss or corruption.
- **Security/Performance:**
  - Anonymize user data where possible.

---

## 17. Notifications
- **Purpose:** Inform users and admins about important events.
- **Inputs:** System events (upload complete, errors, new episodes).
- **Outputs:** Email, in-app, or push notifications.
- **Actions:**
  - Notify users of new episodes, upload status, errors.
  - Alert admins of system issues.
- **Edge Cases:**
  - Notification delivery failures.
- **Security/Performance:**
  - Prevent notification spam.

---

## 18. User Profiles
- **Purpose:** Personalize user experience and track preferences.
- **Inputs:** User actions (favorites, watch history).
- **Outputs:** Personalized recommendations, watch history, favorites list.
- **Actions:**
  - Save and display watch history.
  - Allow users to favorite series/episodes.
  - Update profile info.
- **Edge Cases:**
  - Data sync issues across devices.
- **Security/Performance:**
  - Protect user data privacy.

---

## 19. Subtitles/Closed Captions
- **Purpose:** Provide accessibility for all users.
- **Inputs:** Subtitle files (upload), user selection.
- **Outputs:** Synchronized subtitles during playback.
- **Actions:**
  - Allow upload of subtitle files per episode.
  - Display subtitles in video player.
- **Edge Cases:**
  - Missing or unsynchronized subtitles.
- **Security/Performance:**
  - Validate subtitle file formats.

---

## 20. API Gateway
- **Purpose:** Centralize and secure access to backend microservices.
- **Inputs:** API requests from frontend or external clients.
- **Outputs:** Routed requests to appropriate services, aggregated responses.
- **Actions:**
  - Route requests to correct backend service.
  - Enforce authentication and rate limiting.
- **Edge Cases:**
  - Service unavailability.
- **Security/Performance:**
  - Protect against API abuse. 