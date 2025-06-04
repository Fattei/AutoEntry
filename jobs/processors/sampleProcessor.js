// jobs/processors/sampleProcessor.js
module.exports = async function sampleProcessor(job) {
  const input = job.data.input;

  if (!Array.isArray(input)) throw new Error("Input must be an array.");

  const doubled = input.map((num) => {
    if (typeof num !== "number") throw new Error(`Invalid value: ${num}`);
    return num * 2;
  });

  return { result: doubled };
};
