const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ThumbnailService {
  constructor() {
    this.thumbnailsDir = path.join(__dirname, '../../public/thumbnails');
    this.ensureThumbnailsDirectory();
  }

  /**
   * Ensure thumbnails directory exists
   */
  ensureThumbnailsDirectory() {
    if (!fs.existsSync(this.thumbnailsDir)) {
      fs.mkdirSync(this.thumbnailsDir, { recursive: true });
    }
  }

  /**
   * Generate a unique filename for thumbnail
   * @param {string} originalName - Original filename
   * @returns {string} - Unique filename
   */
  generateThumbnailFilename(originalName) {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName).toLowerCase();
    return `thumb_${timestamp}_${randomString}${ext}`;
  }

  /**
   * Process and save thumbnail
   * @param {Buffer} imageBuffer - Image buffer
   * @param {string} originalName - Original filename
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Processing result
   */
  async processAndSaveThumbnail(imageBuffer, originalName, options = {}) {
    try {
      // Default options
      const defaultOptions = {
        width: 320,
        height: 180,
        quality: 85,
        format: 'jpeg'
      };
      
      const processingOptions = { ...defaultOptions, ...options };
      
      // Generate unique filename
      const filename = this.generateThumbnailFilename(originalName);
      const filePath = path.join(this.thumbnailsDir, filename);
      
      // Process image with Sharp
      const processedImage = await sharp(imageBuffer)
        .resize(processingOptions.width, processingOptions.height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: processingOptions.quality })
        .toBuffer();
      
      // Save processed image
      fs.writeFileSync(filePath, processedImage);
      
      // Get file stats
      const stats = fs.statSync(filePath);
      
      // Generate relative URL for web access
      const relativeUrl = `/thumbnails/${filename}`;
      
      return {
        success: true,
        filename: filename,
        filePath: filePath,
        url: relativeUrl,
        size: stats.size,
        width: processingOptions.width,
        height: processingOptions.height,
        format: processingOptions.format
      };
      
    } catch (error) {
      console.error('Thumbnail processing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate image file
   * @param {Object} file - Multer file object
   * @returns {Object} - Validation result
   */
  validateImageFile(file) {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    const fileName = file.originalname.toLowerCase();
    const ext = path.extname(fileName);
    
    // Check file extension
    if (!allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: 'Invalid file extension. Allowed: jpg, jpeg, png, gif, webp'
      };
    }
    
    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return {
        valid: false,
        error: 'Invalid file type. Only image files are allowed'
      };
    }
    
    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'File too large. Maximum size is 5MB'
      };
    }
    
    return { valid: true };
  }

  /**
   * Delete thumbnail file
   * @param {string} filename - Thumbnail filename
   * @returns {boolean} - Success status
   */
  deleteThumbnail(filename) {
    try {
      const filePath = path.join(this.thumbnailsDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting thumbnail:', error);
      return false;
    }
  }

  /**
   * Get thumbnail info
   * @param {string} filename - Thumbnail filename
   * @returns {Object} - Thumbnail info
   */
  getThumbnailInfo(filename) {
    try {
      const filePath = path.join(this.thumbnailsDir, filename);
      if (!fs.existsSync(filePath)) {
        return { exists: false };
      }
      
      const stats = fs.statSync(filePath);
      return {
        exists: true,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      console.error('Error getting thumbnail info:', error);
      return { exists: false, error: error.message };
    }
  }
}

module.exports = new ThumbnailService(); 