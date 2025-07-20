exports.receiveChunk = (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No chunk file uploaded' });
    }
    res.status(201).json({ message: 'Chunk uploaded successfully', filename: req.file.filename });
}; 