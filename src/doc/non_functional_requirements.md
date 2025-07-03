# Non-Functional Requirements Document: K-Drama Streaming Website

---

## **System Overview**
- **Infrastructure:** Mini data center (1 old PC + 2 laptops) + Google Cloud free tier + Cloudflare CDN
- **Content:** K-drama episodes (16 episodes per series, ~1.5GB each, 2Mbps bitrate)
- **Peak Usage:** 5 new episodes uploaded daily between 22:00-01:00, concurrent streaming during same period

---

## **1. Performance Requirements**

### **Video Streaming Performance**
- **Video Start Time:** Video should start playing within 3 seconds for 90% of users
- **Buffering:** Video should buffer smoothly with < 2 second interruptions for 95% of users
- **Quality Levels:** Support adaptive bitrate streaming (360p, 720p, 1080p) based on user's connection
- **CDN Performance:** Cloudflare should serve video segments with < 100ms latency for 95% of requests

### **Website Performance**
- **Page Load Time:** Homepage should load within 4 seconds on 4G connection (3G: 6 seconds)
- **Search Response:** Search results should appear within 2 seconds for queries up to 1000 series
- **Upload Progress:** Upload progress should be visible and accurate (±5% margin of error)
- **Metadata Loading:** Series/episode metadata should load within 1 second

### **Upload Performance**
- **Chunk Upload:** Each 5MB chunk should upload within 30 seconds on 10Mbps connection
- **Resume Capability:** Upload should resume from last successful chunk after network interruption
- **Transcoding Start:** Transcoding should begin within 2 minutes of upload completion

---

## **2. Scalability Requirements**

### **Current Capacity (Based on Hardware)**
- **Concurrent Streams:** Support 20-30 concurrent video streams during peak hours
- **Upload Capacity:** Handle 5 simultaneous uploads (1GB each) during peak upload window
- **Storage Capacity:** 
  - Total storage: ~480GB (3 × 160GB SSDs)
  - Available for videos: ~300GB (after OS, cache, and redundancy)
  - Can store: ~200 episodes locally
- **Cache Capacity:** Redis metadata cache: 2GB, SSD video cache: 50GB

### **Target Capacity (6-month growth)**
- **Concurrent Users:** Scale to 50-100 concurrent users during peak hours
- **Daily Active Users:** Support 200-500 unique users per day
- **Content Library:** Store metadata for 1000+ series (16,000+ episodes)
- **Peak Upload:** Handle 10 simultaneous uploads during peak window

### **Growth Constraints & Solutions**
- **Storage Limitation:** When local storage fills, implement automatic cleanup of least-watched content
- **Bandwidth Limitation:** Use Cloudflare CDN to distribute video serving load
- **Processing Limitation:** Queue transcoding jobs when all local processors are busy

---

## **3. Security Requirements**

### **Authentication & Authorization**
- **Password Security:** Passwords must be hashed with bcrypt (cost factor 10 for performance)
- **JWT Tokens:** Tokens expire after 12 hours, refresh tokens expire after 7 days
- **Access Control:** 
  - Regular users: View and stream videos
  - Uploaders: Upload videos + view/stream
  - Admins: Full system access
- **Rate Limiting:** 
  - Login attempts: 5 per minute per IP
  - Upload requests: 10 per hour per user
  - API calls: 100 per minute per user

### **Data Protection**
- **Encryption in Transit:** All data must use TLS 1.2+ (HTTPS)
- **Encryption at Rest:** Video files encrypted using AES-256
- **Input Validation:** All user inputs sanitized to prevent XSS, SQL injection, and path traversal
- **File Upload Security:** 
  - Scan all uploaded files for malware
  - Validate file types (only video formats)
  - Maximum file size: 2GB per episode

### **Infrastructure Security**
- **Network Security:** All services bind to localhost, use reverse proxy for external access
- **Redis Security:** Redis bound to localhost, password-protected
- **Cloudflare Security:** Enable WAF (Web Application Firewall) rules
- **Monitoring:** Log all authentication attempts, uploads, and suspicious activities

---

## **4. Reliability Requirements**

### **Availability**
- **Uptime Target:** 95% availability (max 36 hours downtime per month)
- **Scheduled Maintenance:** Maximum 2 hours per week during low-usage periods (06:00-10:00)
- **Recovery Time:** System should recover from failures within 10 minutes
- **Graceful Degradation:** If transcoding fails, show user-friendly error and retry automatically

### **Data Integrity & Backup**
- **Backup Frequency:** Daily backups of metadata and configuration
- **Backup Retention:** 30 days of backups
- **Data Redundancy:** 3 copies of each video file (2 local + 1 cloud)
- **Integrity Checks:** Verify file integrity after upload and transcoding using SHA-256

### **Error Handling & Monitoring**
- **Error Rate:** < 2% error rate for all API endpoints during normal operation
- **Critical Failures:** Alert admin within 10 minutes of service failures
- **Performance Monitoring:** 
  - Monitor CPU, memory, disk usage on all machines
  - Track upload/stream success rates
  - Monitor Cloudflare CDN performance
- **Logging:** Centralized logging with 7-day retention

---

## **5. Resource Constraints & Optimization**

### **Hardware Limitations**
- **RAM Constraint:** 4GB per machine limits concurrent processes
  - Solution: Optimize memory usage, implement process limits
- **CPU Constraint:** G2020 and i5-8250U limit transcoding speed
  - Solution: Queue transcoding jobs, use Google Cloud when available
- **Storage Constraint:** 160GB SSDs limit local content storage
  - Solution: Implement smart caching, prioritize popular content

### **Network Limitations**
- **Upload Bandwidth:** Limited by user's internet connection
  - Solution: Chunked uploads with resume capability
- **Download Bandwidth:** Limited by local internet connection
  - Solution: Use Cloudflare CDN for video distribution

### **Google Cloud Free Tier Limitations**
- **Compute Hours:** Limited free compute hours per month
  - Solution: Use local transcoding as primary, Google Cloud as backup
- **Storage:** Limited free storage
  - Solution: Use for backup copies only, not primary storage

---

## **6. Monitoring & Alerting Requirements**

### **Key Metrics to Monitor**
- **System Health:** CPU, memory, disk usage on all machines
- **Network Performance:** Upload/download speeds, latency
- **User Experience:** Video start times, buffering frequency, error rates
- **Business Metrics:** Daily active users, popular content, upload success rates

### **Alerting Thresholds**
- **Critical:** Service down, disk > 90% full, memory > 90% used
- **Warning:** CPU > 80%, disk > 75% full, error rate > 5%
- **Info:** New uploads, transcoding completions, user registrations

### **Reporting**
- **Daily Reports:** System health, user activity, error summary
- **Weekly Reports:** Performance trends, capacity planning, security events
- **Monthly Reports:** Growth metrics, infrastructure costs, reliability statistics

---

## **7. Compliance & Legal Requirements**

### **Content Management**
- **Copyright Compliance:** Implement DMCA takedown procedures
- **Content Moderation:** Review uploaded content for inappropriate material
- **User Terms:** Clear terms of service and privacy policy

### **Data Privacy**
- **User Data:** Minimize collection, secure storage, clear retention policies
- **Logs:** Anonymize user data in logs where possible
- **GDPR Compliance:** If serving EU users, implement data deletion requests

---

## **8. Disaster Recovery Requirements**

### **Recovery Scenarios**
- **Single Machine Failure:** System continues with remaining machines
- **Network Outage:** Local services continue, sync when network returns
- **Storage Failure:** Recover from cloud backup copies
- **Complete System Failure:** Restore from backups within 24 hours

### **Recovery Procedures**
- **Automated Recovery:** Scripts to restart failed services
- **Manual Recovery:** Documented procedures for admin intervention
- **Testing:** Monthly disaster recovery drills

---

## **Success Criteria**
- **Performance:** 90% of users experience video start times < 3 seconds
- **Reliability:** < 2% error rate during peak usage
- **Scalability:** System handles 50+ concurrent users without degradation
- **Security:** Zero successful security breaches in 12 months
- **User Satisfaction:** < 5% user complaints about performance or reliability 