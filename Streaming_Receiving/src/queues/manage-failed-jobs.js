const { Queue } = require('bullmq');

const connection = { host: '192.168.1.34', port: 6379 };

async function manageFailedJobs() {
  const queue = new Queue('backup', { connection });
  
  try {
    // Get failed jobs
    const failedJobs = await queue.getFailed();
    
    console.log(`Found ${failedJobs.length} failed jobs`);
    
    if (failedJobs.length === 0) {
      console.log('No failed jobs to retry');
      return;
    }
    
    // Retry all failed jobs
    for (const job of failedJobs) {
      console.log(`Retrying job ${job.id}...`);
      await job.retry();
    }
    
    console.log(`Successfully retried ${failedJobs.length} jobs`);
    
  } catch (error) {
    console.error('Error managing failed jobs:', error);
  } finally {
    await queue.close();
  }
}

// Run the function
manageFailedJobs(); 