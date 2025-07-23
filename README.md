# ⚠️ CẢNH BÁO BẢO MẬT

**Lưu ý:** Để thuận tiện cho việc chạy thử dự án, tôi đã đẩy lên GitHub các file cấu hình như `.env` và một số file cấu hình hệ thống. Tuy nhiên, trong thực tế, việc public các file này là điều **tuyệt đối không được làm** vì có thể gây rò rỉ thông tin nhạy cảm (API key, mật khẩu, cấu hình hệ thống, ...). Khi triển khai thực tế hoặc làm việc với dự án sản xuất, hãy luôn giữ các file cấu hình ở chế độ bảo mật, không commit/push lên repository công khai.

---

# K-Drama Website – Hướng dẫn chạy dự án

## Yêu cầu hệ thống

- Node.js >= 18
- Docker & Docker Compose

## 1. Cài đặt các package Node.js

Ở thư mục gốc và trong từng thư mục con của các service, chạy:
```bash
npm install
```

## 2. Khởi động các dịch vụ Docker đặc biệt

### a. Chạy Nginx với cấu hình tuỳ chỉnh

```bash
docker run \
  --hostname=c45994068f6f \
  --env=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  --env=NGINX_VERSION=1.29.0 \
  --env=NJS_VERSION=0.9.0 \
  --env=NJS_RELEASE=1~bookworm \
  --env=PKG_RELEASE=1~bookworm \
  --env=DYNPKG_RELEASE=1~bookworm \
  --volume="C:/Users/quynh/Desktop/Video_Optimized_Website/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
  --network=bridge \
  -p 80:80 \
  --restart=no \
  --label="maintainer=NGINX Docker Maintainers <docker-maint@nginx.com>" \
  --runtime=runc \
  -d nginx
```
> **Lưu ý:**  
> - Đường dẫn file cấu hình nginx.conf cần đúng tuyệt đối trên máy bạn.  
> - Nếu dùng hệ điều hành khác, hãy điều chỉnh lại đường dẫn cho phù hợp.

---

### b. Chạy Redis với các biến môi trường đặc biệt

```bash
docker run \
  --hostname=b009cb95b8f2 \
  --env=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  --env=REDIS_DOWNLOAD_URL=https://github.com/redis/redis/archive/refs/tags/8.0.3.tar.gz \
  --env=REDIS_DOWNLOAD_SHA=2467b9608ecbcc2c0d27397c0c2406b499b6f68bc08ac9f6380b1faf2113ae6f \
  --volume=/data \
  --network=bridge \
  --workdir=/data \
  -p 6379:6379 \
  --restart=no \
  --runtime=runc \
  -d redis
```
> **Lưu ý:**  
> - Nếu muốn lưu dữ liệu Redis ra ngoài container, hãy map volume `/data` ra một thư mục trên máy host, ví dụ:  
>   ```bash
>   --volume="C:/Users/quynh/Desktop/redis_data:/data"
>   ```
> - Nếu không cần, có thể giữ nguyên như trên.

---

## 3. Chạy các server Node.js

Bạn cần chạy 4 server Node.js và 1 worker. Có thể chạy từng lệnh sau ở các terminal khác nhau:

```bash
# 1. Server chính (ở thư mục gốc)
node server.js

# 2. Backup Video Metadata Notify Service
cd Backup_VideoMetadata_Notify_Services
node server.js

# 3. Security Transcoding Service
cd ../Security_Transcoding
node server.js

# 4. Streaming Receiving Service
cd ../Streaming_Receiving
node server.js

# 5. Worker backup (chạy trong Streaming_Receiving)
cd src/queues
node backup.worker.js
```

Hoặc sử dụng script tổng hợp (nếu hệ điều hành hỗ trợ):
```bash
npm run all
```
> Lưu ý: Script này sẽ chạy tất cả các server và worker cùng lúc, nhưng có thể không tương thích trên mọi hệ điều hành.

## 4. Truy cập hệ thống

- Truy cập website qua địa chỉ: [http://localhost:80](http://localhost)
- Các API backend mặc định chạy ở các port: 3000, 3002, 3004, v.v. (xem cấu hình trong code/nginx.conf)

## 5. Một số lưu ý

- Đảm bảo các file `.env` đã được cấu hình đúng ở từng service (nếu có).
- Nếu gặp lỗi port đã được sử dụng, hãy kiểm tra và dừng các tiến trình cũ trước khi chạy lại.
- Để dừng toàn bộ dịch vụ Docker:  
  ```bash
  docker-compose down
  ```

---

**Nếu bạn cần hướng dẫn chi tiết hơn cho từng service hoặc gặp lỗi khi chạy, hãy xem thêm tài liệu trong từng thư mục hoặc liên hệ tác giả dự án.**
