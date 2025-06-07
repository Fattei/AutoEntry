const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null, // ✅ Required for BullMQ compatibility
});

const jobQueue = new Queue('jobQueue', {
  connection,
  defaultJobOptions: {
    attempts: 3, // Default number of attempts
    backoff: {
      type: 'exponential', // Exponential backoff strategy
      delay: 10000,        // Initial delay of 10 seconds
    },
  },
});

module.exports = jobQueue;
