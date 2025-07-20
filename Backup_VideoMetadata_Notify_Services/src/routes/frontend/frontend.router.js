const express = require('express');
const router = express.Router();
const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');

// Get database instance
const db = BetterSqliteDatabase.getInstance();

// Database logic directly in router (for maximum speed)
const getVideosByCategory = async (category) => {
    return await db.listVideos({ genre: category });
};

const getVideosBySearch = async (searchTerm) => {
    const allVideos = await db.listVideos();
    const term = searchTerm.toLowerCase();
    return allVideos.filter(video => 
        video.title.toLowerCase().includes(term) ||
        video.description.toLowerCase().includes(term) ||
        video.genre.toLowerCase().includes(term) ||
        video.actors.toLowerCase().includes(term)
    );
};

const getVideoById = async (id) => {
    return await db.getVideoById(id);
};

const getTrendingVideos = async () => {
    const allVideos = await db.listVideos();
    // Sort by views (we'll use analytics count as proxy for views)
    return allVideos.slice(0, 5);
};

const getRecentVideos = async () => {
    const allVideos = await db.listVideos();
    // Sort by creation date
    return allVideos
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 6);
};

const getFeaturedVideos = async () => {
    const allVideos = await db.listVideos();
    // Get videos with high view count (using analytics as proxy)
    return allVideos.slice(0, 4);
};

const getUserWatchHistory = async (userId) => {
    const analytics = await db.getAnalyticsByUserId(userId);
    const videoIds = [...new Set(analytics.map(a => a.video_id))];
    const videos = [];
    
    for (const videoId of videoIds) {
        const video = await db.getVideoById(videoId);
        if (video) videos.push(video);
    }
    
    return videos;
};

const updateVideoViews = async (videoId, userId = null) => {
    try {
        await db.createVideoAnalytics({
            video_id: videoId,
            user_id: userId,
            ip_address: '127.0.0.1',
            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            watch_duration: 60
        });
        return true;
    } catch (error) {
        console.error('Error updating video views:', error);
        return false;
    }
};

const getVideosByRating = async (minRating) => {
    const allVideos = await db.listVideos();
    // Since we don't have ratings in our DB, we'll return all videos
    return allVideos;
};

const getRelatedVideos = async (videoId, genre) => {
    const allVideos = await db.listVideos();
    return allVideos
        .filter(v => v.genre === genre && v.id !== videoId)
        .slice(0, 3);
};

const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
};

const getVideoWithFiles = async (videoId) => {
    const video = await db.getVideoById(videoId);
    if (!video) return null;
    
    const videoFiles = await db.getVideoFilesByVideoId(videoId);
    return {
        ...video,
        videoFiles: videoFiles,
        duration: formatDuration(video.duration_seconds)
    };
};

// Routes
router.get('/', async (req, res) => {
    try {
        const featuredMovies = await getFeaturedVideos();
        const latestMovies = await getRecentVideos();
        const trendingVideos = await getTrendingVideos();
        
        // Format videos for EJS template
        const formatVideosForTemplate = (videos) => {
            return videos.map(video => ({
                id: video.id,
                title: video.title,
                year: video.year,
                duration: formatDuration(video.duration_seconds),
                genre: video.genre,
                rating: 8.5, // Mock rating since we don't have it in DB
                poster: `/images/${video.original_filename.replace('.mp4', '_poster.jpg')}`,
                description: video.description
            }));
        };
        
        res.render('index', {
            featuredMovies: formatVideosForTemplate(featuredMovies),
            latestMovies: formatVideosForTemplate(latestMovies),
            trendingVideos: formatVideosForTemplate(trendingVideos),
            categories: [
                { id: 1, name: "Action", count: featuredMovies.filter(v => v.genre === "Action").length },
                { id: 2, name: "Sci-Fi", count: featuredMovies.filter(v => v.genre === "Sci-Fi").length },
                { id: 3, name: "Drama", count: 0 },
                { id: 4, name: "Comedy", count: 0 }
            ]
        });
    } catch (error) {
        console.error('Error loading homepage:', error);
        res.status(500).render('error', {
            message: 'Internal server error',
            categories: []
        });
    }
});

router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        let searchResults = [];
        
        if (q) {
            searchResults = await getVideosBySearch(q);
        }
        
        const formatVideosForTemplate = (videos) => {
            return videos.map(video => ({
                id: video.id,
                title: video.title,
                year: video.year,
                duration: formatDuration(video.duration_seconds),
                genre: video.genre,
                rating: 8.5,
                poster: `/images/${video.original_filename.replace('.mp4', '_poster.jpg')}`,
                description: video.description
            }));
        };
        
        res.render('search', {
            searchResults: formatVideosForTemplate(searchResults),
            searchQuery: q || '',
            categories: [
                { id: 1, name: "Action", count: 0 },
                { id: 2, name: "Sci-Fi", count: 0 },
                { id: 3, name: "Drama", count: 0 },
                { id: 4, name: "Comedy", count: 0 }
            ]
        });
    } catch (error) {
        console.error('Error loading search page:', error);
        res.status(500).render('error', {
            message: 'Internal server error',
            categories: []
        });
    }
});

// Auth page routes (for rendering pages)
router.get('/auth/login', (req, res) => {
    res.render('login', {
        error: req.query.error,
        success: req.query.success,
        email: req.query.email
    });
});

router.get('/auth/register', (req, res) => {
    res.render('register', {
        error: req.query.error,
        success: req.query.success,
        email: req.query.email
    });
});

router.get('/dashboard', async (req, res) => {
    try {
        res.render('dashboard');
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).render('error', {
            message: 'Internal server error'
        });
    }
});

router.get('/movie/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const video = await getVideoWithFiles(id);
        
        if (!video) {
            return res.status(404).render('error', {
                message: 'Video not found',
                categories: []
            });
        }
        
        // Update views
        await updateVideoViews(id);
        
        // Get related videos
        const relatedVideos = await getRelatedVideos(id, video.genre);
        
        const formatVideosForTemplate = (videos) => {
            return videos.map(video => ({
                id: video.id,
                title: video.title,
                year: video.year,
                duration: formatDuration(video.duration_seconds),
                genre: video.genre,
                rating: 8.5,
                poster: `/images/${video.original_filename.replace('.mp4', '_poster.jpg')}`,
                description: video.description
            }));
        };
        
        res.render('movie-detail', {
            movie: {
                ...video,
                poster: `/images/${video.original_filename.replace('.mp4', '_poster.jpg')}`,
                rating: 8.5,
                views: 0, // No views field in DB, so default to 0
                country: "Mỹ", // Mock country
                director: "Unknown", // Mock director
                cast: video.actors || "Unknown", // Use actors from DB
                type: "movie" // Default to movie type
            },
            relatedVideos: formatVideosForTemplate(relatedVideos),
            categories: [
                { id: 1, name: "Action", count: 0 },
                { id: 2, name: "Sci-Fi", count: 0 },
                { id: 3, name: "Drama", count: 0 },
                { id: 4, name: "Comedy", count: 0 }
            ]
        });
    } catch (error) {
        console.error('Error loading movie detail:', error);
        res.status(500).render('error', {
            message: 'Internal server error',
            categories: []
        });
    }
});

router.get('/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const videos = await getVideosByCategory(category);
        
        const formatVideosForTemplate = (videos) => {
            return videos.map(video => ({
                id: video.id,
                title: video.title,
                year: video.year,
                duration: formatDuration(video.duration_seconds),
                genre: video.genre,
                rating: 8.5,
                poster: `/images/${video.original_filename.replace('.mp4', '_poster.jpg')}`,
                description: video.description
            }));
        };
        
        res.render('search', {
            searchResults: formatVideosForTemplate(videos),
            searchTerm: category,
            categories: [
                { id: 1, name: "Action", count: 0 },
                { id: 2, name: "Sci-Fi", count: 0 },
                { id: 3, name: "Drama", count: 0 },
                { id: 4, name: "Comedy", count: 0 }
            ]
        });
    } catch (error) {
        console.error('Error loading category page:', error);
        res.status(500).render('error', {
            message: 'Internal server error',
            categories: []
        });
    }
});

router.get('/ranking', async (req, res) => {
    try {
        const allVideos = await db.listVideos();
        
        const formatVideosForTemplate = (videos) => {
            return videos.map(video => ({
                id: video.id,
                title: video.title,
                year: video.year,
                duration: formatDuration(video.duration_seconds),
                genre: video.genre,
                rating: 8.5,
                poster: `/images/${video.original_filename.replace('.mp4', '_poster.jpg')}`,
                description: video.description
            }));
        };
        
        res.render('ranking', {
            topRated: formatVideosForTemplate(allVideos.slice(0, 10)),
            mostViewed: formatVideosForTemplate(allVideos.slice(0, 10)),
            categories: [
                { id: 1, name: "Action", count: 0 },
                { id: 2, name: "Sci-Fi", count: 0 },
                { id: 3, name: "Drama", count: 0 },
                { id: 4, name: "Comedy", count: 0 }
            ]
        });
    } catch (error) {
        console.error('Error loading ranking page:', error);
        res.status(500).render('error', {
            message: 'Internal server error',
            categories: []
        });
    }
});

router.get('/player/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const video = await getVideoWithFiles(id);
        
        if (!video) {
            return res.status(404).render('error', {
                message: 'Video not found',
                categories: []
            });
        }
        
        // Update views
        await updateVideoViews(id);
        
        const episodeNumber = 1;
        
        res.render('player', {
            movie: {
                ...video,
                poster: `/images/${video.original_filename.replace('.mp4', '_poster.jpg')}`,
                rating: 8.5,
                type: "movie",
                totalEpisodes: 1
            },
            episode: {
                number: episodeNumber,
                videoUrl: `/videos/${video.original_filename}`,
                title: video.title
            },
            categories: [
                { id: 1, name: "Action", count: 0 },
                { id: 2, name: "Sci-Fi", count: 0 },
                { id: 3, name: "Drama", count: 0 },
                { id: 4, name: "Comedy", count: 0 }
            ]
        });
    } catch (error) {
        console.error('Error loading player page:', error);
        res.status(500).render('error', {
            message: 'Internal server error',
            categories: []
        });
    }
});

// Add a separate route for episodes if needed
router.get('/player/:id/:episode', async (req, res) => {
    try {
        const { id, episode } = req.params;
        const video = await getVideoWithFiles(id);
        
        if (!video) {
            return res.status(404).render('error', {
                message: 'Video not found',
                categories: []
            });
        }
        
        // Update views
        await updateVideoViews(id);
        
        const episodeNumber = parseInt(episode) || 1;
        
        res.render('player', {
            movie: {
                ...video,
                poster: `/images/${video.original_filename.replace('.mp4', '_poster.jpg')}`,
                rating: 8.5,
                type: "movie",
                totalEpisodes: 1
            },
            episode: {
                number: episodeNumber,
                videoUrl: `/videos/${video.original_filename}`,
                title: video.title
            },
            categories: [
                { id: 1, name: "Action", count: 0 },
                { id: 2, name: "Sci-Fi", count: 0 },
                { id: 3, name: "Drama", count: 0 },
                { id: 4, name: "Comedy", count: 0 }
            ]
        });
    } catch (error) {
        console.error('Error loading player page:', error);
        res.status(500).render('error', {
            message: 'Internal server error',
            categories: []
        });
    }
});

router.get('/auth/login', (req, res) => {
    res.render('login', {
        categories: [
            { id: 1, name: "Action", count: 0 },
            { id: 2, name: "Sci-Fi", count: 0 },
            { id: 3, name: "Drama", count: 0 },
            { id: 4, name: "Comedy", count: 0 }
        ]
    });
});

router.get('/auth/register', (req, res) => {
    res.render('register', {
        categories: [
            { id: 1, name: "Action", count: 0 },
            { id: 2, name: "Sci-Fi", count: 0 },
            { id: 3, name: "Drama", count: 0 },
            { id: 4, name: "Comedy", count: 0 }
        ]
    });
});

router.get('/upload', (req, res) => {
    res.render('upload', {
        categories: [
            { id: 1, name: "Action", count: 0 },
            { id: 2, name: "Sci-Fi", count: 0 },
            { id: 3, name: "Drama", count: 0 },
            { id: 4, name: "Comedy", count: 0 }
        ]
    });
});

// API endpoints for AJAX requests
router.get('/api/videos/trending', async (req, res) => {
    try {
        const trendingVideos = await getTrendingVideos();
        res.json({ videos: trendingVideos });
    } catch (error) {
        console.error('Error getting trending videos:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/api/videos/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.json({ videos: [] });
        }
        
        const searchResults = await getVideosBySearch(q);
        res.json({ videos: searchResults });
    } catch (error) {
        console.error('Error searching videos:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/api/videos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const video = await getVideoById(id);
        
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        // Update views
        await updateVideoViews(id);
        
        res.json({ video: video });
    } catch (error) {
        console.error('Error getting video:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/api/videos/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const videos = await getVideosByCategory(category);
        
        res.json({ videos: videos });
    } catch (error) {
        console.error('Error getting videos by category:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/api/user/:userId/history', async (req, res) => {
    try {
        const { userId } = req.params;
        const watchHistory = await getUserWatchHistory(userId);
        
        res.json({ watchHistory: watchHistory });
    } catch (error) {
        console.error('Error getting user history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/api/videos/rating/:minRating', async (req, res) => {
    try {
        const { minRating } = req.params;
        const videos = await getVideosByRating(parseFloat(minRating));
        
        res.json({ videos: videos });
    } catch (error) {
        console.error('Error getting videos by rating:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling
router.use((req, res) => {
    res.status(404).render('error', {
        error: 404,
        message: 'Page not found',
        categories: []
    });
});

module.exports = router; 