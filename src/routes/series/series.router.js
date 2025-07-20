const express = require('express');
const router = express.Router();
const authUser = require('../../middlewares/authUser.middleware');
const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase');

const db = BetterSqliteDatabase.getInstance();

// GET /api/v1/series/user/:userId - Get all series created by a user
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const series = await db.getSeriesByUserId(userId);
        res.json(series);
    } catch (error) {
        console.error('Error fetching user series:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// // POST /api/v1/series - Create a new series
// router.post('/', authUser, async (req, res) => {
//     try {
//         const seriesData = req.body;
        
//         // Validate total episodes requirement
//         if (!seriesData.total_episodes || seriesData.total_episodes < 2) {
//             return res.status(400).json({ 
//                 error: 'Series must have at least 2 episodes',
//                 message: 'Series phải có ít nhất 2 tập'
//             });
//         }
        
//         const newSeries = await db.createSeries(seriesData);
//         res.status(201).json(newSeries);
//     } catch (error) {
//         console.error('Error creating series:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });

// GET /api/v1/series/:id - Get series by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const series = await db.getSeriesById(id);
        if (!series) {
            return res.status(404).json({ error: 'Series not found' });
        }
        res.json(series);
    } catch (error) {
        console.error('Error fetching series:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/v1/series/:id - Update series
router.put('/:id', authUser, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const success = await db.updateSeries(id, updates);
        if (!success) {
            return res.status(404).json({ error: 'Series not found' });
        }
        res.json({ message: 'Series updated successfully' });
    } catch (error) {
        console.error('Error updating series:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/v1/series/:id - Delete series
router.delete('/:id', authUser, async (req, res) => {
    try {
        const { id } = req.params;
        const success = await db.deleteSeries(id);
        if (!success) {
            return res.status(404).json({ error: 'Series not found' });
        }
        res.json({ message: 'Series deleted successfully' });
    } catch (error) {
        console.error('Error deleting series:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/v1/series - List all series with optional filters
router.get('/', async (req, res) => {
    try {
        const filter = req.query;
        const series = await db.listSeries(filter);
        res.json(series);
    } catch (error) {
        console.error('Error listing series:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/v1/series/:id/episodes - Get episodes for a specific series
router.get('/:id/episodes', async (req, res) => {
    try {
        const { id } = req.params;
        const episodes = await db.getEpisodesBySeriesId(id);
        res.json(episodes);
    } catch (error) {
        console.error('Error fetching series episodes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router; 