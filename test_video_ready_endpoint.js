const axios = require('axios');

async function testVideoReadyEndpoint() {
    try {
        console.log('🧪 Testing video-ready-to-serve endpoint...');
        
        // Test data
        const testData = {
            videoId: 1 // Replace with an actual video ID from your database
        };
        
        console.log('📤 Sending request to /videometadata/service/video-ready-to-serve');
        console.log('📋 Request data:', testData);
        
        // Make the request
        const response = await axios.post('http://localhost:3000/videometadata/service/video-ready-to-serve', testData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Response received:');
        console.log('📊 Status:', response.status);
        console.log('📋 Response data:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Error testing endpoint:');
        if (error.response) {
            console.error('📊 Status:', error.response.status);
            console.error('📋 Error data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('🚫 Network error:', error.message);
        }
    }
}

// Instructions for testing
console.log('📋 Instructions:');
console.log('1. Make sure your server is running on port 3000');
console.log('2. Replace the videoId in the test with an actual video ID from your database');
console.log('3. Run this script to test the endpoint');
console.log('');

testVideoReadyEndpoint(); 