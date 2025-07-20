const express = require('express');
const router = express.Router();
const authUser = require('../../middlewares/authUser.middleware');
const axios = require('axios');

const axiosConfig = { headers: { 'x-api-key': process.env.UPLOAD_SHARE_API_KEY } };



// POST /api/v1/series - Create a new series //
router.post('/', authUser, async (req, res) => {
    try {
        const seriesData = req.body;
        // Validate total episodes requirement
        if (!seriesData.total_episodes || seriesData.total_episodes < 2) {
            return res.status(400).json({ 
                error: 'Series must have at least 2 episodes',
                message: 'Series phải có ít nhất 2 tập'
            });
        }
        const response = await axios.post(`${process.env.DB_SERVER_HOST}/createSeries`, seriesData, axiosConfig);
        res.status(201).json(response.data);
    } catch (error) {
        console.error('Error creating series:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// PUT /api/v1/series/:id - Update series
router.put('/:id', authUser, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const response = await axios.put(`${process.env.DB_SERVER_HOST}/updateSeries/${id}`, updates, axiosConfig);
        const success = response.data && response.data.success;
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
        const response = await axios.delete(`${process.env.DB_SERVER_HOST}/deleteSeries/${id}`, axiosConfig);
        const success = response.data && response.data.success;
        if (!success) {
            return res.status(404).json({ error: 'Series not found' });
        }
        res.json({ message: 'Series deleted successfully' });
    } catch (error) {
        console.error('Error deleting series:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


module.exports = router; 