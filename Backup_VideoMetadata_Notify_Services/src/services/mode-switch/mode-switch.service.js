const axios = require('axios');
const config = require('../../config/laptop-config');

class ModeSwitchService {
  constructor() {
    // Configuration for laptop communication
    this.laptopBaseUrl = config.laptop.baseUrl;
    this.timeout = config.laptop.timeouts.modeSwitch;
    this.retryConfig = config.network.retry;
  }

  /**
   * Send request to laptop to switch to uploading mode with retry logic
   * @param {Object} options - Configuration options
   * @param {string} options.uploadId - The upload ID that triggered the switch
   * @param {number} options.totalChunks - Total number of chunks received
   * @param {string} options.filename - Original filename
   * @param {string} options.chunkDirectory - Directory where chunks are stored
   */
  async requestUploadMode(options) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        console.log(`Requesting laptop to switch to upload mode for uploadId: ${options.uploadId} (attempt ${attempt}/${this.retryConfig.maxAttempts})`);
        
        const requestData = {
          action: 'switch_to_upload_mode',
          uploadId: options.uploadId,
          totalChunks: options.totalChunks,
          filename: options.filename,
          chunkDirectory: options.chunkDirectory,
          timestamp: new Date().toISOString(),
          source: config.oldPC.identifier
        };

        const response = await axios.post(
          `${this.laptopBaseUrl}${config.laptop.endpoints.modeSwitch}`,
          requestData,
          {
            timeout: this.timeout,
            headers: {
              'Content-Type': 'application/json',
              'X-Source': config.oldPC.identifier
            }
          }
        );

        console.log(`Successfully requested mode switch (attempt ${attempt}). Response:`, response.data);
        return {
          success: true,
          response: response.data,
          statusCode: response.status,
          attempts: attempt
        };

      } catch (error) {
        lastError = error;
        console.error(`Failed to request mode switch (attempt ${attempt}):`, error.message);
        
        if (attempt < this.retryConfig.maxAttempts) {
          const delay = this.retryConfig.delayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    console.error('All attempts to request mode switch failed');
    
    if (lastError.response) {
      // Server responded with error status
      console.error('Server error response:', lastError.response.data);
      return {
        success: false,
        error: lastError.response.data,
        statusCode: lastError.response.status,
        attempts: this.retryConfig.maxAttempts
      };
    } else if (lastError.request) {
      // Request was made but no response received
      console.error('No response received from laptop');
      return {
        success: false,
        error: 'No response from laptop - check if laptop is running and accessible',
        statusCode: null,
        attempts: this.retryConfig.maxAttempts
      };
    } else {
      // Something else happened
      console.error('Request setup error:', lastError.message);
      return {
        success: false,
        error: lastError.message,
        statusCode: null,
        attempts: this.retryConfig.maxAttempts
      };
    }
  }

  /**
   * Check if laptop is accessible
   */
  async checkLaptopStatus() {
    try {
      const response = await axios.get(
        `${this.laptopBaseUrl}${config.laptop.endpoints.health}`,
        { timeout: config.laptop.timeouts.healthCheck }
      );
      
      return {
        accessible: true,
        status: response.data,
        statusCode: response.status
      };
    } catch (error) {
      return {
        accessible: false,
        error: error.message
      };
    }
  }

  /**
   * Get laptop's current mode
   */
  async getLaptopMode() {
    try {
      const response = await axios.get(
        `${this.laptopBaseUrl}${config.laptop.endpoints.currentMode}`,
        { timeout: config.laptop.timeouts.general }
      );
      
      return {
        success: true,
        mode: response.data.mode,
        status: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ModeSwitchService(); 