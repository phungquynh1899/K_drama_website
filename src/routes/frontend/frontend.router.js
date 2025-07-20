const express = require('express');
const router = express.Router();
const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');
const authUser = require('../../middlewares/authUser.middleware')
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

// New functions for movies and series
const getMovies = async () => {
    // Get all videos that are not part of a series (series_id is null)
    const allVideos = await db.listVideos();
    return allVideos.filter(video => !video.series_id);
};

const getSeries = async () => {
    // Get all series
    return await db.listSeries();
};

const getSeriesWithEpisodes = async () => {
    const series = await db.listSeries();
    const seriesWithEpisodes = [];
    
    for (const seriesItem of series) {
        const episodes = await db.getEpisodesBySeriesId(seriesItem.id);
        seriesWithEpisodes.push({
            ...seriesItem,
            episodeCount: episodes.length
        });
    }
    
    return seriesWithEpisodes;
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
        // Get movies and series data
        const movies = await getMovies();
        const series = await getSeriesWithEpisodes();
        
        // Format videos for EJS template
        const formatMoviesForTemplate = (videos) => {
            return videos.map(video => ({
                id: video.id,
                title: video.title,
                year: video.year,
                duration: formatDuration(video.duration_seconds),
                genre: video.genre,
                rating: 8.5, // Mock rating since we don't have it in DB
                thumbnail_url: video.thumbnail_url,
                poster: video.thumbnail_url || `/images/${video.original_filename.replace('.mp4', '_poster.jpg')}`,
                description: video.description,
                country: video.country,
                director: video.actors, // Use actors as director for now
                cast: video.actors,
                views: 0 // Mock views
            }));
        };
        
        const formatSeriesForTemplate = (series) => {
            return series.map(seriesItem => ({
                id: seriesItem.id,
                title: seriesItem.name,
                year: seriesItem.year,
                episodeCount: seriesItem.episodeCount || seriesItem.total_episodes,
                genre: seriesItem.genre,
                rating: 8.5, // Mock rating
                thumbnail_url: seriesItem.thumbnail_url,
                poster: seriesItem.thumbnail_url || seriesItem.poster,
                description: seriesItem.description,
                country: seriesItem.country,
                director: seriesItem.director,
                cast: seriesItem.cast,
                views: 0 // Mock views
            }));
        };
        
        res.render('index', {
            movies: formatMoviesForTemplate(movies),
            series: formatSeriesForTemplate(series),
            categories: [
                { id: 1, name: "Action", count: movies.filter(v => v.genre === "Action").length },
                { id: 2, name: "Sci-Fi", count: movies.filter(v => v.genre === "Sci-Fi").length },
                { id: 3, name: "Drama", count: movies.filter(v => v.genre === "Drama").length },
                { id: 4, name: "Comedy", count: movies.filter(v => v.genre === "Comedy").length }
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
        const { 
            q, 
            category, 
            genre, 
            country, 
            year, 
            duration, 
            page = 1
        } = req.query;
        
        let searchResults = [];
        let movies = [];
        let series = [];
        
        // Get all videos and series
        const allVideos = await db.listVideos();
        const allSeries = await getSeriesWithEpisodes();
        
        // Log for debugging
        console.log(`Search request - Query: "${q}", Category: "${category}", Genre: "${genre}", Country: "${country}", Year: "${year}", Duration: "${duration}", Page: ${page}`);
        console.log(`Found ${allVideos.length} videos and ${allSeries.length} series`);
        
        // Filter by search query
        if (q) {
            const searchTerm = q.toLowerCase();
            
            // Helper function to safely convert to string and check if includes search term
            const safeStringIncludes = (value, searchTerm) => {
                if (!value) return false;
                const stringValue = String(value).toLowerCase();
                return stringValue.includes(searchTerm);
            };
            
            // Search in videos
            movies = allVideos.filter(video => 
                safeStringIncludes(video.title, searchTerm) ||
                safeStringIncludes(video.description, searchTerm) ||
                safeStringIncludes(video.genre, searchTerm) ||
                safeStringIncludes(video.actors, searchTerm)
            );
            
            // Search in series
            series = allSeries.filter(seriesItem => 
                safeStringIncludes(seriesItem.name, searchTerm) ||
                safeStringIncludes(seriesItem.description, searchTerm) ||
                safeStringIncludes(seriesItem.genre, searchTerm) ||
                safeStringIncludes(seriesItem.cast, searchTerm)
            );
        } else {
            movies = allVideos;
            series = allSeries;
        }
        
        // Filter by category (movie/series)
        if (category === 'movie') {
            series = [];
        } else if (category === 'series') {
            movies = [];
        }
        
        // Filter by genre
        if (genre) {
            const genreLower = genre.toLowerCase();
            movies = movies.filter(video => {
                if (!video.genre) return false;
                return String(video.genre).toLowerCase() === genreLower;
            });
            series = series.filter(seriesItem => {
                if (!seriesItem.genre) return false;
                return String(seriesItem.genre).toLowerCase() === genreLower;
            });
        }
        
        // Filter by country
        if (country) {
            const countryLower = country.toLowerCase();
            movies = movies.filter(video => {
                if (!video.country) return false;
                return String(video.country).toLowerCase() === countryLower;
            });
            series = series.filter(seriesItem => {
                if (!seriesItem.country) return false;
                return String(seriesItem.country).toLowerCase() === countryLower;
            });
        }
        
        // Filter by year
        if (year) {
            const yearInt = parseInt(year);
            movies = movies.filter(video => video.year === yearInt);
            series = series.filter(seriesItem => seriesItem.year === yearInt);
        }
        
        // Filter by duration
        if (duration) {
            movies = movies.filter(video => {
                const videoDuration = video.duration_seconds;
                if (!videoDuration) return false; // Skip videos without duration
                
                switch (duration) {
                    case 'short': return videoDuration < 1800; // < 30 min
                    case 'medium': return videoDuration >= 1800 && videoDuration <= 3600; // 30-60 min
                    case 'long': return videoDuration > 3600 && videoDuration <= 5400; // 1-1.5 hours
                    case 'very-long': return videoDuration > 5400; // > 1.5 hours
                    default: return true;
                }
            });
        }
        
        // Combine and sort results
        const formatMoviesForTemplate = (videos) => {
            return videos.map(video => ({
                id: video.id,
                title: video.title || 'Untitled',
                year: video.year || 2024,
                duration: video.duration_seconds ? formatDuration(video.duration_seconds) : 'Unknown',
                genre: video.genre || 'Unknown',
                rating: 8.5, // Mock rating
                thumbnail_url: video.thumbnail_url,
                poster: video.thumbnail_url || (video.original_filename ? `/images/${video.original_filename.replace('.mp4', '_poster.jpg')}` : null),
                description: video.description || '',
                type: 'movie',
                created_at: video.created_at
            }));
        };
        
        const formatSeriesForTemplate = (seriesList) => {
            return seriesList.map(seriesItem => ({
                id: seriesItem.id,
                title: seriesItem.name || 'Untitled',
                year: seriesItem.year || 2024,
                episodeCount: seriesItem.episodeCount || seriesItem.total_episodes || 0,
                genre: seriesItem.genre || 'Unknown',
                rating: 8.5, // Mock rating
                thumbnail_url: seriesItem.thumbnail_url,
                poster: seriesItem.thumbnail_url || seriesItem.poster,
                description: seriesItem.description || '',
                type: 'series',
                created_at: seriesItem.created_at
            }));
        };
        
        // Format results
        const formattedMovies = formatMoviesForTemplate(movies);
        const formattedSeries = formatSeriesForTemplate(series);
        
        // Combine results
        searchResults = [...formattedMovies, ...formattedSeries];
        
        // Sort results by title (default)
        searchResults.sort((a, b) => {
            const titleA = a.title || '';
            const titleB = b.title || '';
            return titleA.localeCompare(titleB);
        });
        
        // Pagination
        const itemsPerPage = 12;
        const totalItems = searchResults.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const currentPage = Math.max(1, Math.min(parseInt(page), totalPages));
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedResults = searchResults.slice(startIndex, endIndex);
        
        // Build query string for pagination
        const queryParams = new URLSearchParams();
        if (q) queryParams.set('q', q);
        if (category) queryParams.set('category', category);
        if (genre) queryParams.set('genre', genre);
        if (country) queryParams.set('country', country);
        if (year) queryParams.set('year', year);
        if (duration) queryParams.set('duration', duration);
        
        const pagination = {
            currentPage,
            totalPages,
            totalItems,
            itemsPerPage,
            queryString: queryParams.toString()
        };
        
        console.log(`Final results: ${searchResults.length} total, ${paginatedResults.length} on current page`);
        
        res.render('search', {
            searchResults: paginatedResults,
            searchQuery: q || '',
            category: category || '',
            genre: genre || '',
            country: country || '',
            year: year || '',
            duration: duration || '',
            pagination
        });
    } catch (error) {
        console.error('Error loading search page:', error);
        console.error('Error stack:', error.stack);
        res.status(500).render('error', {
            message: 'Internal server error',
            categories: []
        });
    }
});

// Movies page route
router.get('/movies', async (req, res) => {
    try {
        const movies = await getMovies();
        
        const formatMoviesForTemplate = (videos) => {
            return videos.map(video => ({
                id: video.id,
                title: video.title,
                year: video.year,
                duration: formatDuration(video.duration_seconds),
                genre: video.genre,
                rating: 8.5,
                thumbnail_url: video.thumbnail_url,
                poster: video.thumbnail_url || `/images/${video.original_filename.replace('.mp4', '_poster.jpg')}`,
                description: video.description,
                country: video.country,
                director: video.actors,
                cast: video.actors,
                views: 0
            }));
        };
        
        res.render('movies', {
            movies: formatMoviesForTemplate(movies),
            categories: [
                { id: 1, name: "Action", count: movies.filter(v => v.genre === "Action").length },
                { id: 2, name: "Sci-Fi", count: movies.filter(v => v.genre === "Sci-Fi").length },
                { id: 3, name: "Drama", count: movies.filter(v => v.genre === "Drama").length },
                { id: 4, name: "Comedy", count: movies.filter(v => v.genre === "Comedy").length }
            ]
        });
    } catch (error) {
        console.error('Error loading movies page:', error);
        res.status(500).render('error', {
            message: 'Internal server error',
            categories: []
        });
    }
});

// Series page route
router.get('/series', async (req, res) => {
    try {
        const series = await getSeriesWithEpisodes();
        
        const formatSeriesForTemplate = (series) => {
            return series.map(seriesItem => ({
                id: seriesItem.id,
                title: seriesItem.name,
                year: seriesItem.year,
                episodeCount: seriesItem.episodeCount || seriesItem.total_episodes,
                genre: seriesItem.genre,
                rating: 8.5,
                thumbnail_url: seriesItem.thumbnail_url,
                poster: seriesItem.thumbnail_url || seriesItem.poster,
                description: seriesItem.description,
                country: seriesItem.country,
                director: seriesItem.director,
                cast: seriesItem.cast,
                views: 0
            }));
        };
        
        res.render('series', {
            series: formatSeriesForTemplate(series),
            categories: [
                { id: 1, name: "Action", count: series.filter(s => s.genre === "Action").length },
                { id: 2, name: "Sci-Fi", count: series.filter(s => s.genre === "Sci-Fi").length },
                { id: 3, name: "Drama", count: series.filter(s => s.genre === "Drama").length },
                { id: 4, name: "Comedy", count: series.filter(s => s.genre === "Comedy").length }
            ]
        });
    } catch (error) {
        console.error('Error loading series page:', error);
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

//đáng lý phải có authUser ở đây, nhưng do frontend viết bằng ejs, 
//việc nhét thêm authentication Header quá rối rắm 
//mà mình thì không muốn đổi sang react 
//nên tạm thời endpoint này được mở public
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
                thumbnail_url: video.thumbnail_url,
                poster: video.thumbnail_url || `/images/${video.original_filename.replace('.mp4', '_poster.jpg')}`,
                rating: 8.5,
                views: 0, // No views field in DB, so default to 0
                country: video.country || "Mỹ", // Use country from DB or default
                director: video.actors || "Unknown", // Use actors as director
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

// Series detail route
router.get('/series/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const series = await db.getSeriesById(id);
        
        if (!series) {
            return res.status(404).render('error', {
                message: 'Series not found',
                categories: []
            });
        }
        
        // Get episodes for this series
        const episodes = await db.getEpisodesBySeriesId(id);
        
        // Get related series
        const allSeries = await db.listSeries();
        const relatedSeries = allSeries
            .filter(s => s.genre === series.genre && s.id !== series.id)
            .slice(0, 3);
        
        const formatSeriesForTemplate = (seriesList) => {
            return seriesList.map(seriesItem => ({
                id: seriesItem.id,
                title: seriesItem.name,
                year: seriesItem.year,
                episodeCount: seriesItem.total_episodes,
                genre: seriesItem.genre,
                rating: 8.5,
                thumbnail_url: seriesItem.thumbnail_url,
                poster: seriesItem.thumbnail_url || seriesItem.poster,
                description: seriesItem.description
            }));
        };
        
        res.render('movie-detail', {
            movie: {
                ...series,
                id: series.id,
                title: series.name,
                thumbnail_url: series.thumbnail_url,
                poster: series.thumbnail_url || series.poster,
                rating: 8.5,
                views: 0,
                country: series.country || "Mỹ",
                director: series.director || "Unknown",
                cast: series.cast || "Unknown",
                type: "series",
                episodes: episodes.map(episode => ({
                    number: episode.episode_number,
                    title: episode.title || `Tập ${episode.episode_number}`
                }))
            },
            relatedMovies: formatSeriesForTemplate(relatedSeries),
            categories: [
                { id: 1, name: "Action", count: 0 },
                { id: 2, name: "Sci-Fi", count: 0 },
                { id: 3, name: "Drama", count: 0 },
                { id: 4, name: "Comedy", count: 0 }
            ]
        });
    } catch (error) {
        console.error('Error loading series detail:', error);
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

router.get('/uploadSeries', (req, res) => {
    res.render('uploadSeries', {
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