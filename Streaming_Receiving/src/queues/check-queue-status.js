const { Queue } = require('bullmq');

const connection = { host: '192.168.1.34', port: 6379 };

async function checkQueueStatus() {
  const queue = new Queue('backup', { connection });
  
  try {
    // Get different job states
    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();
    
    console.log('=== Queue Status ===');
    console.log(`Waiting jobs: ${waiting.length}`);
    console.log(`Active jobs: ${active.length}`);
    console.log(`Completed jobs: ${completed.length}`);
    console.log(`Failed jobs: ${failed.length}`);
    
    if (waiting.length > 0) {
      console.log('\n=== Waiting Jobs (Will Auto-Resume) ===');
      waiting.forEach(job => {
        console.log(`Job ${job.id}: ${JSON.stringify(job.data)}`);
      });
      console.log('💡 These jobs will automatically resume when worker starts!');
    }
    
    if (active.length > 0) {
      console.log('\n=== Active Jobs (Interrupted - "Home for Interrupted Jobs") ===');
      active.forEach(job => {
        console.log(`Job ${job.id}: ${JSON.stringify(job.data)}`);
      });
      console.log('🏠 These jobs are in "Home for Interrupted Jobs"');
      console.log('💡 They were interrupted by external events (power loss, Ctrl+C, network)');
      console.log('✅ Safe to retry immediately - no underlying problem to fix');
    }
    
    if (failed.length > 0) {
      console.log('\n=== Failed Jobs (Business Logic Failures - "Home for Failed Jobs") ===');
      failed.forEach(job => {
        console.log(`Job ${job.id}: ${job.failedReason}`);
        console.log(`  Data: ${JSON.stringify(job.data)}`);
      });
      console.log('🏠 These jobs are in "Home for Failed Jobs"');
      console.log('💡 They failed due to business logic (disk space, network timeout, invalid data)');
      console.log('⚠️  May need system fixes before retry');
      console.log('🚨 These jobs need manual retry with manage-failed-jobs.js');
    }
    
    // Give recommendations
    console.log('\n=== Recommendations ===');
    if (waiting.length > 0) {
      console.log('✅ You can start the worker directly - waiting jobs will auto-resume');
    }
    if (active.length > 0) {
      console.log('🔄 Active jobs can be safely retried - they were just interrupted');
    }
    if (failed.length > 0) {
      console.log('🚨 Failed jobs may need investigation before retry');
      console.log('🔄 Run manage-failed-jobs.js to retry failed jobs');
    }
    
  } catch (error) {
    console.error('Error checking queue status:', error);
  } finally {
    await queue.close();
  }
}

// Run the function
checkQueueStatus(); 