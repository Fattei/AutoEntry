// jobs/queue.js
const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis(); // Defaults to localhost:6379

const jobQueue = new Queue("automation-jobs", {
  connection,
});

module.exports = jobQueue;
