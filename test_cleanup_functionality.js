const fs = require('fs').promises;
const path = require('path');

async function testCleanupFunctionality() {
    try {
        console.log('🧪 Testing cleanup functionality...');
        
        // Create a test temporary folder
        const testUploadId = 'test_upload_123';
        const tempFolderPath = path.join(process.cwd(), 'uploads', 'tmp', testUploadId);
        
        console.log('📁 Creating test temporary folder:', tempFolderPath);
        
        // Create the directory structure
        await fs.mkdir(tempFolderPath, { recursive: true });
        
        // Create a test file in the folder
        const testFilePath = path.join(tempFolderPath, 'test_video.mp4');
        await fs.writeFile(testFilePath, 'test video content');
        
        console.log('✅ Test folder and file created successfully');
        
        // Verify the folder exists
        const folderExists = await fs.access(tempFolderPath).then(() => true).catch(() => false);
        console.log('📋 Folder exists before cleanup:', folderExists);
        
        // Simulate the cleanup process
        console.log('🧹 Cleaning up temporary folder...');
        await fs.rm(tempFolderPath, { recursive: true, force: true });
        
        // Verify the folder is deleted
        const folderExistsAfter = await fs.access(tempFolderPath).then(() => true).catch(() => false);
        console.log('📋 Folder exists after cleanup:', folderExistsAfter);
        
        if (!folderExistsAfter) {
            console.log('✅ Cleanup test passed! Temporary folder was successfully removed.');
        } else {
            console.log('❌ Cleanup test failed! Temporary folder still exists.');
        }
        
    } catch (error) {
        console.error('❌ Error during cleanup test:', error.message);
    }
}

// Instructions
console.log('📋 Cleanup Functionality Test');
console.log('This test verifies that the file system cleanup works correctly.');
console.log('It creates a temporary folder, adds a test file, then removes it.');
console.log('');

testCleanupFunctionality(); 