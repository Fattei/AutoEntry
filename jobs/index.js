const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const jobQueue = require('./queue');
const sampleProcessor = require('./processors/sampleProcessor');
const puppeteerProcessor = require('./processors/puppeteerProcessor');
const { prisma } = require('../lib/prisma'); // Prisma client

const connection = new IORedis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null, // Required for BullMQ compatibility
});

// Ensure a demo user exists for test jobs
async function ensureDemoUser(userId = 'demo-user-id') {
  return prisma.user.upsert({
    where: { user_id: userId },
    update: {}, // No fields to update if the user already exists
    create: {
      user_id: userId,
      email: `${userId}@example.com`, // Dummy email, must be unique
      password_hash: 'dummy_password_hash', // Dummy password hash
    },
  });
}

// Add a test job for the sampleProcessor
async function addSampleTestJob() {
  const userId = 'demo-user-id';
  await ensureDemoUser(userId);

  const input = [2, 4, 6, 8, "ten"]; // Includes bad input to test error handling

  const dbJob = await prisma.dataProcessingJob.create({
    data: {
      user_id: userId,
      job_name: 'Double Numbers Job',
      job_type: 'data_transformation_sample',
      status: 'queued',
      config: { input },
    },
  });

  await jobQueue.add('doubleNumbers', {
    jobId: dbJob.job_id,
    userId,
    input,
  });

  await jobQueue.add('scrapeWebPage', {
  jobId: dbJob.job_id,
  userId,
  url: 'https://quotes.toscrape.com/',
  puppeteerOptions: { headless: true },
  actions: [
    { type: 'extract', name: 'allQuotes', selector: '.quote .text' }, // Extracts text content
    { type: 'extract', name: 'authorLinks', selector: '.quote .author + a', attribute: 'href' }, // Extracts 'href' attribute
    { type: 'click', selector: '.pager .next a' }, // Click the "Next" button
    { type: 'extract', name: 'quotesPage2', selector: '.quote .text' } // Extract quotes from the next page
  ]
});

  console.log(`📝 Added sample job ${dbJob.job_id} to queue.`);
}

// Add a test job for the puppeteerProcessor
async function addPuppeteerTestJob() {
  const userId = 'demo-user-id';
  await ensureDemoUser(userId);

  const targetUrl = 'https://example.com'; // Target URL for scraping

  const dbJob = await prisma.dataProcessingJob.create({
    data: {
      user_id: userId,
      job_name: `Scrape: ${targetUrl}`,
      job_type: 'web_scraping_puppeteer',
      status: 'queued',
      config: { url: targetUrl, puppeteerOptions: { headless: true } }, // Store URL and any options
    },
  });

  await jobQueue.add('scrapeWebPage', {
    jobId: dbJob.job_id,
    userId,
    url: targetUrl,
    puppeteerOptions: { headless: true } // Pass options to the processor
  });

  console.log(`📝 Added Puppeteer job ${dbJob.job_id} to queue for URL: ${targetUrl}.`);
}


// Worker: listens for new jobs and processes them
function startWorker() {
  const worker = new Worker(
    'jobQueue',
    async (job) => {
      const { jobId, userId } = job.data; // Common data
      let processorResult;
      // Clone job.data for context logging, removing redundant fields
      const jobSpecificContextData = { ...job.data };
      delete jobSpecificContextData.jobId;
      delete jobSpecificContextData.userId;


      console.log(`🚀 Processing job: ${job.id}, Name: ${job.name}, Data:`, JSON.stringify(job.data));

      try {
        // --- Job Type Routing ---
        if (job.name === 'doubleNumbers') {
          processorResult = await sampleProcessor({ data: job.data });
        } else if (job.name === 'scrapeWebPage') {
          processorResult = await puppeteerProcessor({ data: job.data });
        } else {
          console.error(`Unknown job name: ${job.name} for job ID: ${job.id}`);
          throw new Error(`Unknown job name: ${job.name}`);
        }
        // --- End Job Type Routing ---

        // 1. Update job status to completed
        await prisma.dataProcessingJob.update({
          where: { job_id: jobId },
          data: {
            status: 'completed',
            completed_at: new Date(),
          },
        });

        // 2. Log result
        await prisma.processingResult.create({
          data: {
            job_id: jobId,
            user_id: userId,
            result_type: `${job.name}_result`, // e.g., 'doubleNumbers_result' or 'scrapeWebPage_result'
            data: processorResult, // Store the full result from the processor
            status: 'success',
          },
        });

        return processorResult;
      } catch (err) {
        console.error(`Error processing job ${job.id} (${job.name}):`, err.message);
        // 1. Mark job as failed in DB
        await prisma.dataProcessingJob.update({
          where: { job_id: jobId },
          data: {
            status: 'failed',
            completed_at: new Date(), // Mark completion time even for failures
          },
        });

        // 2. Log error details in ErrorLog table
        await prisma.errorLog.create({
          data: {
            job_id: jobId,
            user_id: userId,
            error_message: err.message,
            error_stack: err.stack,
            severity: 'error',
            context_data: jobSpecificContextData, // Log the specific data for this job
          },
        });
        throw err; // Important to re-throw for BullMQ to mark as failed and trigger 'failed' event
      }
    },
    { connection }
  );

  worker.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} (${job.name}) completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    // Logging is already done in the main try/catch, but this event is useful for other monitoring
    console.error(`❌ Job ${job.id} (${job.name}) failed event:`, err.message);
  });

  worker.on('error', err => {
    // Generic worker errors (e.g., connection issues)
    console.error('Worker error:', err);
  });

  console.log('Worker started and listening for jobs...');
}

// Main execution
async function main() {
  await addSampleTestJob();
  await addPuppeteerTestJob(); // Add a puppeteer job as well
  startWorker();
}

main().catch(e => {
  console.error("Error in main execution:", e);
  process.exit(1);
});
