module.exports = {
  // Laptop configuration
  laptop: {
    // Update this with your laptop's actual IP address
    baseUrl: process.env.LAPTOP_BASE_URL || 'http://192.168.1.100:3000',
    
    // API endpoints
    endpoints: {
      modeSwitch: '/api/v1/mode/switch',
      health: '/api/v1/health',
      currentMode: '/api/v1/mode/current'
    },
    
    // Timeout settings (in milliseconds)
    timeouts: {
      modeSwitch: 10000,  // 10 seconds
      healthCheck: 5000,  // 5 seconds
      general: 8000       // 8 seconds
    }
  },
  
  // Old PC configuration
  oldPC: {
    // This PC's identifier
    identifier: 'old_pc_upload_service',
    
    // Upload settings
    upload: {
      chunkSizeMB: 64,
      maxConcurrentUploads: 3
    }
  },
  
  // Network settings
  network: {
    // Retry settings for failed requests
    retry: {
      maxAttempts: 3,
      delayMs: 1000,
      backoffMultiplier: 2
    }
  },
  
  // Server B configuration (placeholder)
  serverB: {
    baseUrl: process.env.SERVER_B_BASE_URL || 'http://localhost:3002',
    endpoints: {
      canAcceptUpload: '/can-accept-upload'
    },
    timeouts: {
      canAcceptUpload: 8000 // 8 seconds
    }
  }
}; 