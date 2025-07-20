const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');
const hlsService = require('../../services/videostreaming/hls.service');
const { NotFoundError } = require('../../response/error.response');

// Serve the video player page
exports.servePlayer = async (req, res, next) => {
  try {
    const { videoId, episodeNumber } = req.params;
    const db = BetterSqliteDatabase.getInstance();

    // Get video metadata
    const video = await db.getVideoById(videoId);
    if (!video || !video.is_public) {
      throw new NotFoundError('Video not found or not public');
    }

    // Check if video has HLS files
    const hasHLS = await hlsService.hasHLSFiles(videoId);
    
    // Create episode object
    const episode = {
      number: episodeNumber ? parseInt(episodeNumber) : 1,
      videoUrl: hasHLS ? `/api/v1/hls/playlist/${videoId}` : null
    };

    // For series, get all episodes
    let episodes = [];
    if (video.title && video.title.toLowerCase().includes('episode')) {
      // This is a series, get all episodes
      const allVideos = await db.listVideos({ is_public: 1 });
      episodes = allVideos
        .filter(v => v.title && v.title.toLowerCase().includes(video.title.split(' ')[0].toLowerCase()))
        .sort((a, b) => {
          const aEpisode = parseInt(a.title.match(/episode\s*(\d+)/i)?.[1] || '0');
          const bEpisode = parseInt(b.title.match(/episode\s*(\d+)/i)?.[1] || '0');
          return aEpisode - bEpisode;
        })
        .map(v => ({
          number: parseInt(v.title.match(/episode\s*(\d+)/i)?.[1] || '1'),
          title: v.title,
          hasHLS: hlsService.hasHLSFiles(v.id)
        }));
    }

    // Render the player page
    res.render('player', {
      movie: {
        id: video.id,
        title: video.title,
        year: video.year,
        genre: video.genre,
        country: video.country || 'Unknown',
        rating: video.rating || 8.5,
        duration: video.duration_seconds ? `${Math.floor(video.duration_seconds / 60)}m` : 'Unknown',
        description: video.description,
        type: episodes.length > 1 ? 'series' : 'movie',
        totalEpisodes: episodes.length,
        episodes: episodes
      },
      episode: episode
    });

  } catch (error) {
    next(error);
  }
};

// Serve the video player page for series
exports.serveSeriesPlayer = async (req, res, next) => {
  try {
    const { seriesId, episodeNumber } = req.params;
    const db = BetterSqliteDatabase.getInstance();

    // Get all videos in the series
    const allVideos = await db.listVideos({ is_public: 1 });
    const seriesVideos = allVideos
      .filter(v => v.title && v.title.toLowerCase().includes(seriesId.toLowerCase()))
      .sort((a, b) => {
        const aEpisode = parseInt(a.title.match(/episode\s*(\d+)/i)?.[1] || '0');
        const bEpisode = parseInt(b.title.match(/episode\s*(\d+)/i)?.[1] || '0');
        return aEpisode - bEpisode;
      });

    if (seriesVideos.length === 0) {
      throw new NotFoundError('Series not found');
    }

    const currentEpisode = parseInt(episodeNumber) || 1;
    const currentVideo = seriesVideos.find(v => {
      const episode = parseInt(v.title.match(/episode\s*(\d+)/i)?.[1] || '1');
      return episode === currentEpisode;
    });

    if (!currentVideo) {
      throw new NotFoundError('Episode not found');
    }

    // Check if current video has HLS files
    const hasHLS = await hlsService.hasHLSFiles(currentVideo.id);

    // Create episode object
    const episode = {
      number: currentEpisode,
      videoUrl: hasHLS ? `/api/v1/hls/playlist/${currentVideo.id}` : null
    };

    // Create episodes list
    const episodes = seriesVideos.map(v => ({
      number: parseInt(v.title.match(/episode\s*(\d+)/i)?.[1] || '1'),
      title: v.title,
      hasHLS: hlsService.hasHLSFiles(v.id)
    }));

    // Render the player page
    res.render('player', {
      movie: {
        id: currentVideo.id,
        title: currentVideo.title,
        year: currentVideo.year,
        genre: currentVideo.genre,
        country: currentVideo.country || 'Unknown',
        rating: currentVideo.rating || 8.5,
        duration: currentVideo.duration_seconds ? `${Math.floor(currentVideo.duration_seconds / 60)}m` : 'Unknown',
        description: currentVideo.description,
        type: 'series',
        totalEpisodes: episodes.length,
        episodes: episodes
      },
      episode: episode
    });

  } catch (error) {
    next(error);
  }
}; 