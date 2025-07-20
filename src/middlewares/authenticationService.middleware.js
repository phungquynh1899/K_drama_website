
const authenticationService = async (req, res, next)=>{
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(403).json({ error: 'Missing API key' });
    const keyExists = process.env.UPLOAD_SHARE_API_KEY;
    if (keyExists !== apiKey) return res.status(403).json({ error: 'Invalid API key' });
    next();    
}

module.exports = authenticationService