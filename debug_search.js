const BetterSqliteDatabase = require('./src/db/BetterSqliteDatabase');

async function debugSearch() {
    try {
        const db = BetterSqliteDatabase.getInstance();
        
        console.log('🔍 Debugging search functionality...');
        
        // Get all videos and check their data types
        const allVideos = await db.listVideos();
        console.log(`\n📊 Found ${allVideos.length} videos`);
        
        if (allVideos.length > 0) {
            console.log('\n🔍 Checking data types for first few videos:');
            allVideos.slice(0, 3).forEach((video, index) => {
                console.log(`\nVideo ${index + 1}:`);
                console.log(`  ID: ${video.id} (${typeof video.id})`);
                console.log(`  Title: "${video.title}" (${typeof video.title})`);
                console.log(`  Description: "${video.description}" (${typeof video.description})`);
                console.log(`  Genre: "${video.genre}" (${typeof video.genre})`);
                console.log(`  Actors: "${video.actors}" (${typeof video.actors})`);
                console.log(`  Year: ${video.year} (${typeof video.year})`);
                console.log(`  Duration: ${video.duration_seconds} (${typeof video.duration_seconds})`);
                console.log(`  Country: "${video.country}" (${typeof video.country})`);
            });
        }
        
        // Test the safe string function
        console.log('\n🧪 Testing safe string conversion:');
        const testValues = [null, undefined, '', 'test', 123, 0, false, true];
        
        const safeStringIncludes = (value, searchTerm) => {
            if (!value) return false;
            const stringValue = String(value).toLowerCase();
            return stringValue.includes(searchTerm);
        };
        
        testValues.forEach(value => {
            try {
                const result = safeStringIncludes(value, 'test');
                console.log(`  "${value}" (${typeof value}) -> ${result}`);
            } catch (error) {
                console.log(`  ❌ Error with "${value}": ${error.message}`);
            }
        });
        
        // Test actual search with safe function
        console.log('\n🔍 Testing actual search with safe function:');
        const searchTerm = 'test';
        
        const videosWithSearch = allVideos.filter(video => {
            try {
                return safeStringIncludes(video.title, searchTerm) ||
                       safeStringIncludes(video.description, searchTerm) ||
                       safeStringIncludes(video.genre, searchTerm) ||
                       safeStringIncludes(video.actors, searchTerm);
            } catch (error) {
                console.log(`  ❌ Error filtering video ${video.id}: ${error.message}`);
                return false;
            }
        });
        
        console.log(`✅ Found ${videosWithSearch.length} videos matching "${searchTerm}"`);
        
        console.log('\n✅ Debug completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during debug:', error);
        console.error('Stack trace:', error.stack);
    }
}

debugSearch(); 