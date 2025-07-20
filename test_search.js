const BetterSqliteDatabase = require('./src/db/BetterSqliteDatabase');

async function testSearch() {
    try {
        const db = BetterSqliteDatabase.getInstance();
        
        console.log('Testing search functionality...');
        
        // Test 1: Get all videos
        console.log('\n1. Getting all videos:');
        const allVideos = await db.listVideos();
        console.log(`Found ${allVideos.length} videos`);
        
        if (allVideos.length > 0) {
            console.log('Sample video:', {
                id: allVideos[0].id,
                title: allVideos[0].title,
                genre: allVideos[0].genre,
                actors: allVideos[0].actors,
                year: allVideos[0].year,
                duration_seconds: allVideos[0].duration_seconds
            });
        }
        
        // Test 2: Get all series
        console.log('\n2. Getting all series:');
        const allSeries = await db.listSeries();
        console.log(`Found ${allSeries.length} series`);
        
        if (allSeries.length > 0) {
            console.log('Sample series:', {
                id: allSeries[0].id,
                name: allSeries[0].name,
                genre: allSeries[0].genre,
                cast: allSeries[0].cast,
                year: allSeries[0].year
            });
        }
        
        // Test 3: Test search functionality
        console.log('\n3. Testing search with null safety:');
        const searchTerm = 'test';
        
        // Test videos search
        const videosWithSearch = allVideos.filter(video => 
            (video.title && video.title.toLowerCase().includes(searchTerm)) ||
            (video.description && video.description.toLowerCase().includes(searchTerm)) ||
            (video.genre && video.genre.toLowerCase().includes(searchTerm)) ||
            (video.actors && video.actors.toLowerCase().includes(searchTerm))
        );
        
        console.log(`Videos matching "${searchTerm}": ${videosWithSearch.length}`);
        
        // Test series search
        const seriesWithSearch = allSeries.filter(seriesItem => 
            (seriesItem.name && seriesItem.name.toLowerCase().includes(searchTerm)) ||
            (seriesItem.description && seriesItem.description.toLowerCase().includes(searchTerm)) ||
            (seriesItem.genre && seriesItem.genre.toLowerCase().includes(searchTerm)) ||
            (seriesItem.cast && seriesItem.cast.toLowerCase().includes(searchTerm))
        );
        
        console.log(`Series matching "${searchTerm}": ${seriesWithSearch.length}`);
        
        // Test 4: Test filtering
        console.log('\n4. Testing filtering:');
        
        // Test genre filter
        const actionVideos = allVideos.filter(video => 
            video.genre && video.genre.toLowerCase() === 'action'
        );
        console.log(`Videos with genre "action": ${actionVideos.length}`);
        
        // Test year filter
        const videos2024 = allVideos.filter(video => video.year === 2024);
        console.log(`Videos from 2024: ${videos2024.length}`);
        
        // Test duration filter
        const shortVideos = allVideos.filter(video => {
            if (!video.duration_seconds) return false;
            return video.duration_seconds < 1800; // < 30 min
        });
        console.log(`Short videos (< 30 min): ${shortVideos.length}`);
        
        console.log('\n✅ Search functionality test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error testing search functionality:', error);
    }
}

testSearch(); 