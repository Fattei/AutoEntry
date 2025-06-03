const { handleError } = require("./error-handler");

async function runJob(context) {
  try {
    // ✅ Simulated data-entry automation task: doubling numbers in an array
    if (!Array.isArray(context.input)) {
      throw new Error("Input must be an array.");
    }

    const result = context.input.map((num) => {
      if (typeof num !== "number") {
        throw new Error("All elements must be numbers.");
      }
      return num * 2;
    });

    console.log("✅ Job completed successfully. Result:", result);
  } catch (error) {
    await handleError(error, context); // Only this triggers GPT
  }
}

module.exports = { runJob };
