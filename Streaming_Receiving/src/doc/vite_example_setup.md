# Vite Setup for K-Drama Website Interactive Pages

## Why Vite is Perfect for Your Use Case

Vite is a modern build tool that's much more efficient than Create React App:

- **Faster startup**: 3-5 seconds vs 10-15 seconds
- **Lower memory**: 150-250MB vs 400-600MB  
- **Better performance**: ES modules, tree-shaking
- **Smaller bundles**: 500KB-1MB vs 2-5MB

## Project Structure

```
k-drama-website/
├── old-pc/                    # Main server (Node.js + EJS)
│   ├── server.js
│   ├── views/
│   │   ├── index.ejs         # Homepage
│   │   ├── series.ejs        # Series listing
│   │   └── profile.ejs       # User profiles
│   └── public/
│       └── css/
├── laptop-1/                  # Interactive pages (Vite)
│   ├── video-player/
│   │   ├── index.html
│   │   ├── main.js
│   │   ├── video-player.js
│   │   └── package.json
│   └── upload-interface/
│       ├── index.html
│       ├── main.js
│       ├── upload.js
│       └── package.json
└── laptop-2/                  # Admin dashboard (Vite)
    ├── admin-dashboard/
    │   ├── index.html
    │   ├── main.js
    │   ├── dashboard.js
    │   └── package.json
```

## Video Player Setup (Vite + Vanilla JS)

### 1. Initialize Vite Project
```bash
# On laptop-1
mkdir video-player
cd video-player
npm init -y
npm install vite --save-dev
```

### 2. Package.json
```json
{
  "name": "video-player",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  },
  "dependencies": {
    "video.js": "^8.0.0"
  }
}
```

### 3. HTML Structure
```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>K-Drama Player</title>
    <link href="https://vjs.zencdn.net/8.0.0/video-js.css" rel="stylesheet" />
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: #1a1a1a;
            color: white;
            font-family: Arial, sans-serif;
        }
        .player-container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .video-js {
            width: 100%;
            height: 600px;
        }
        .episode-list {
            margin-top: 20px;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
        }
        .episode-card {
            background: #2a2a2a;
            padding: 15px;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.3s;
        }
        .episode-card:hover {
            background: #3a3a3a;
        }
    </style>
</head>
<body>
    <div class="player-container">
        <video
            id="video-player"
            class="video-js vjs-default-skin"
            controls
            preload="auto"
            width="100%"
            height="600"
            data-setup="{}"
        >
            <p class="vjs-no-js">
                To view this video please enable JavaScript, and consider upgrading to a
                web browser that supports HTML5 video.
            </p>
        </video>
        
        <div class="episode-list" id="episode-list">
            <!-- Episodes will be loaded here -->
        </div>
    </div>
    
    <script type="module" src="/main.js"></script>
</body>
</html>
```

### 4. JavaScript (Vanilla JS)
```javascript
// main.js
import videojs from 'video.js';
import { VideoPlayer } from './video-player.js';

// Initialize video player
const player = new VideoPlayer();
player.init();

// Load episode data
player.loadEpisodes();
```

```javascript
// video-player.js
import videojs from 'video.js';

export class VideoPlayer {
    constructor() {
        this.player = null;
        this.currentEpisode = null;
        this.episodes = [];
    }

    init() {
        // Initialize Video.js player
        this.player = videojs('video-player', {
            fluid: true,
            responsive: true,
            playbackRates: [0.5, 1, 1.25, 1.5, 2],
            controlBar: {
                children: [
                    'playToggle',
                    'volumePanel',
                    'currentTimeDisplay',
                    'timeDivider',
                    'durationDisplay',
                    'progressControl',
                    'playbackRateMenuButton',
                    'qualitySelector',
                    'fullscreenToggle'
                ]
            }
        });

        // Add custom controls
        this.addCustomControls();
        
        // Handle player events
        this.setupEventListeners();
    }

    addCustomControls() {
        // Add custom quality selector
        const qualityButton = document.createElement('button');
        qualityButton.innerHTML = 'Quality';
        qualityButton.className = 'vjs-control vjs-button';
        qualityButton.onclick = () => this.showQualityMenu();
        
        this.player.controlBar.addChild('Button', {}, 7);
    }

    setupEventListeners() {
        // Handle video end
        this.player.on('ended', () => {
            this.playNextEpisode();
        });

        // Handle errors
        this.player.on('error', (error) => {
            console.error('Video error:', error);
            this.showErrorMessage('Video playback error. Please try again.');
        });
    }

    async loadEpisodes() {
        try {
            // Fetch episodes from your API
            const response = await fetch('/api/episodes');
            this.episodes = await response.json();
            
            this.renderEpisodeList();
        } catch (error) {
            console.error('Failed to load episodes:', error);
        }
    }

    renderEpisodeList() {
        const container = document.getElementById('episode-list');
        container.innerHTML = '';

        this.episodes.forEach((episode, index) => {
            const card = document.createElement('div');
            card.className = 'episode-card';
            card.innerHTML = `
                <h3>Episode ${episode.number}</h3>
                <p>${episode.title}</p>
                <small>${episode.duration}</small>
            `;
            
            card.onclick = () => this.loadEpisode(episode);
            container.appendChild(card);
        });
    }

    async loadEpisode(episode) {
        try {
            this.currentEpisode = episode;
            
            // Update player source
            this.player.src({
                src: episode.videoUrl,
                type: 'video/mp4'
            });

            // Update UI
            this.updateEpisodeInfo(episode);
            
            // Start playing
            this.player.play();
            
        } catch (error) {
            console.error('Failed to load episode:', error);
            this.showErrorMessage('Failed to load episode. Please try again.');
        }
    }

    updateEpisodeInfo(episode) {
        // Update page title
        document.title = `${episode.title} - K-Drama Player`;
        
        // Update episode list highlighting
        const cards = document.querySelectorAll('.episode-card');
        cards.forEach((card, index) => {
            if (this.episodes[index].id === episode.id) {
                card.style.background = '#4a4a4a';
            } else {
                card.style.background = '#2a2a2a';
            }
        });
    }

    playNextEpisode() {
        if (!this.currentEpisode) return;
        
        const currentIndex = this.episodes.findIndex(ep => ep.id === this.currentEpisode.id);
        const nextEpisode = this.episodes[currentIndex + 1];
        
        if (nextEpisode) {
            this.loadEpisode(nextEpisode);
        }
    }

    showQualityMenu() {
        const qualities = ['1080p', '720p', '480p', '360p'];
        const menu = document.createElement('div');
        menu.className = 'quality-menu';
        menu.style.cssText = `
            position: absolute;
            top: 50px;
            right: 10px;
            background: rgba(0,0,0,0.9);
            border-radius: 4px;
            padding: 10px;
            z-index: 1000;
        `;
        
        qualities.forEach(quality => {
            const item = document.createElement('div');
            item.innerHTML = quality;
            item.style.cssText = 'padding: 5px 10px; cursor: pointer; color: white;';
            item.onclick = () => this.changeQuality(quality);
            menu.appendChild(item);
        });
        
        document.body.appendChild(menu);
        
        // Remove menu after selection
        setTimeout(() => {
            if (menu.parentNode) {
                menu.parentNode.removeChild(menu);
            }
        }, 3000);
    }

    changeQuality(quality) {
        // Implement quality switching logic
        console.log(`Switching to ${quality}`);
    }

    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 15px;
            border-radius: 4px;
            z-index: 1000;
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    destroy() {
        if (this.player) {
            this.player.dispose();
        }
    }
}
```

## Upload Interface Setup

### 1. Package.json
```json
{
  "name": "upload-interface",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  },
  "dependencies": {
    "resumable.js": "^1.1.0"
  }
}
```

### 2. HTML Structure
```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Upload K-Drama</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: #1a1a1a;
            color: white;
            font-family: Arial, sans-serif;
        }
        .upload-container {
            max-width: 800px;
            margin: 0 auto;
        }
        .upload-area {
            border: 2px dashed #666;
            border-radius: 8px;
            padding: 40px;
            text-align: center;
            margin: 20px 0;
            transition: border-color 0.3s;
        }
        .upload-area.dragover {
            border-color: #4CAF50;
            background: rgba(76, 175, 80, 0.1);
        }
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #333;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background: #4CAF50;
            width: 0%;
            transition: width 0.3s;
        }
        .file-list {
            margin-top: 20px;
        }
        .file-item {
            background: #2a2a2a;
            padding: 15px;
            margin: 10px 0;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
    </style>
</head>
<body>
    <div class="upload-container">
        <h1>Upload K-Drama</h1>
        
        <div class="upload-area" id="upload-area">
            <h3>Drag & Drop Video Files Here</h3>
            <p>or click to select files</p>
            <input type="file" id="file-input" multiple accept="video/*" style="display: none;">
        </div>
        
        <div class="file-list" id="file-list">
            <!-- Uploaded files will appear here -->
        </div>
    </div>
    
    <script type="module" src="/main.js"></script>
</body>
</html>
```

### 3. JavaScript (Vanilla JS)
```javascript
// main.js
import { UploadManager } from './upload.js';

const uploadManager = new UploadManager();
uploadManager.init();
```

```javascript
// upload.js
import Resumable from 'resumable.js';

export class UploadManager {
    constructor() {
        this.resumable = null;
        this.uploadArea = null;
        this.fileList = null;
        this.uploads = new Map();
    }

    init() {
        this.uploadArea = document.getElementById('upload-area');
        this.fileList = document.getElementById('file-list');
        
        this.setupResumable();
        this.setupEventListeners();
    }

    setupResumable() {
        this.resumable = new Resumable({
            target: '/api/upload',
            chunkSize: 1024 * 1024, // 1MB chunks
            simultaneousUploads: 3,
            testChunks: true,
            throttleProgressCallbacks: 1
        });

        // Handle file selection
        this.resumable.on('fileAdded', (file) => {
            this.addFileToList(file);
        });

        // Handle upload progress
        this.resumable.on('fileProgress', (file) => {
            this.updateFileProgress(file);
        });

        // Handle upload success
        this.resumable.on('fileSuccess', (file, response) => {
            this.handleUploadSuccess(file, response);
        });

        // Handle upload error
        this.resumable.on('fileError', (file, message) => {
            this.handleUploadError(file, message);
        });
    }

    setupEventListeners() {
        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });

        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            
            const files = Array.from(e.dataTransfer.files);
            this.resumable.addFiles(files);
        });

        // Click to select
        this.uploadArea.addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        document.getElementById('file-input').addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.resumable.addFiles(files);
        });
    }

    addFileToList(file) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div>
                <h4>${file.fileName}</h4>
                <p>Size: ${this.formatFileSize(file.size)}</p>
            </div>
            <div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
                <span class="progress-text">0%</span>
            </div>
        `;
        
        this.fileList.appendChild(fileItem);
        this.uploads.set(file.uniqueIdentifier, fileItem);
        
        // Start upload
        this.resumable.upload();
    }

    updateFileProgress(file) {
        const fileItem = this.uploads.get(file.uniqueIdentifier);
        if (!fileItem) return;
        
        const progress = Math.round(file.progress() * 100);
        const progressFill = fileItem.querySelector('.progress-fill');
        const progressText = fileItem.querySelector('.progress-text');
        
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;
    }

    handleUploadSuccess(file, response) {
        const fileItem = this.uploads.get(file.uniqueIdentifier);
        if (!fileItem) return;
        
        fileItem.style.background = '#2d5a2d';
        fileItem.innerHTML = `
            <div>
                <h4>${file.fileName}</h4>
                <p>✅ Upload Complete</p>
            </div>
        `;
        
        // Trigger transcoding
        this.triggerTranscoding(file.fileName);
    }

    handleUploadError(file, message) {
        const fileItem = this.uploads.get(file.uniqueIdentifier);
        if (!fileItem) return;
        
        fileItem.style.background = '#5a2d2d';
        fileItem.innerHTML = `
            <div>
                <h4>${file.fileName}</h4>
                <p>❌ Upload Failed: ${message}</p>
                <button onclick="retryUpload('${file.uniqueIdentifier}')">Retry</button>
            </div>
        `;
    }

    triggerTranscoding(fileName) {
        fetch('/api/transcode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fileName })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Transcoding started:', data);
        })
        .catch(error => {
            console.error('Failed to start transcoding:', error);
        });
    }

    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}
```

## Development Commands

### Start Development Server
```bash
# Video Player
cd video-player
npm run dev

# Upload Interface  
cd upload-interface
npm run dev
```

### Build for Production
```bash
# Video Player
npm run build

# Upload Interface
npm run build
```

## Memory Usage Comparison

| Component | Memory Usage | Startup Time |
|-----------|--------------|--------------|
| Vite Dev Server | 80-120MB | 2-3 seconds |
| Video.js | 5-10MB | Instant |
| Resumable.js | 2-5MB | Instant |
| **Total** | **~90-140MB** | **2-3 seconds** |

## Benefits for Your Setup

1. **Lightweight**: 90-140MB vs 400-600MB for CRA
2. **Fast Development**: 2-3s startup vs 10-15s for CRA
3. **Small Bundles**: 50-200KB vs 2-5MB for CRA
4. **Modern Features**: Hot reload, ES modules, tree-shaking
5. **Simple**: Vanilla JS, no framework overhead

## Integration with Main Server

The Vite-built pages can be served by your main Node.js server:

```javascript
// On old PC server.js
app.get('/player/:videoId', (req, res) => {
    res.sendFile(path.join(__dirname, '../laptop-1/video-player/dist/index.html'));
});

app.get('/upload', (req, res) => {
    res.sendFile(path.join(__dirname, '../laptop-1/upload-interface/dist/index.html'));
});
```

This gives you the best of both worlds: fast static pages with EJS and lightweight interactive pages with Vite! 