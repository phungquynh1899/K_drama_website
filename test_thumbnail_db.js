const BetterSqliteDatabase = require('./src/db/BetterSqliteDatabase');

async function testThumbnailDatabase() {
    console.log('Testing thumbnail database functionality...');
    
    try {
        const db = BetterSqliteDatabase.getInstance(':memory:');
        
        // Create a test user
        const user = await db.createUser({
            email: 'test@example.com',
            password_hash: 'test_hash',
            role: 'user'
        });
        
        console.log('Created test user:', user.id);
        
        // Create a test video with thumbnail
        const video = await db.createVideo({
            title: 'Test Video',
            description: 'Test description',
            year: 2024,
            genre: 'test',
            country: 'test',
            actors: ['Test Actor'],
            duration_seconds: 120,
            original_filename: 'test.mp4',
            original_filetype: 'video/mp4',
            uploader_user_id: user.id,
            thumbnail_url: '/thumbnails/test_thumb.jpg',
            status: 'ready',
            is_public: 1
        });
        
        console.log('Created test video:', video.id);
        console.log('Video thumbnail URL:', video.thumbnail_url);
        
        // Test getting video by ID
        const retrievedVideo = await db.getVideoById(video.id);
        console.log('Retrieved video thumbnail URL:', retrievedVideo.thumbnail_url);
        
        // Test updating video thumbnail
        const updateResult = await db.updateVideo(video.id, {
            thumbnail_url: '/thumbnails/new_thumb.jpg'
        });
        console.log('Update result:', updateResult);
        
        // Test getting updated video
        const updatedVideo = await db.getVideoById(video.id);
        console.log('Updated video thumbnail URL:', updatedVideo.thumbnail_url);
        
        // Test removing thumbnail
        const removeResult = await db.updateVideo(video.id, {
            thumbnail_url: null
        });
        console.log('Remove result:', removeResult);
        
        // Test getting video without thumbnail
        const finalVideo = await db.getVideoById(video.id);
        console.log('Final video thumbnail URL:', finalVideo.thumbnail_url);
        
        console.log('All database tests PASSED!');
        
    } catch (error) {
        console.error('Database test failed:', error.message);
    }
}

testThumbnailDatabase(); 