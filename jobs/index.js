// jobs/index.js
const { Worker } = require("bullmq");
const jobQueue = require("./queue");
const sampleProcessor = require("./processors/sampleProcessor");
const IORedis = require("ioredis");

// Optional: Add a test job
async function addTestJob() {
  await jobQueue.add("doubleNumbers", {
    input: [2, 4, 6, 8, "ten"], // includes a bad value for error test
  });
}

// Worker: listens for new jobs and processes them
function startWorker() {
  const connection = new IORedis();

  const worker = new Worker(
    "automation-jobs",
    async (job) => {
      console.log("Processing job:", job.name);
      return await sampleProcessor(job);
    },
    { connection }
  );

  worker.on("completed", (job, result) => {
    console.log(`✅ Job ${job.id} completed:`, result);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ Job ${job.id} failed:`, err.message);
  });
}

addTestJob();
startWorker();
