require("dotenv").config();
console.log("Loaded API Key:", process.env.OPENAI_API_KEY);

const { runJob } = require("./job-runner");

const context = {
  jobName: "Double Numbers Job",
  input: [2, 4, 6, 8, "ten"], // ← Intentionally includes a bad value to test error handling
};

runJob(context);
