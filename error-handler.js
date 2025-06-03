const getFixSuggestion = require("./ai-advisor");

async function handleError(err, context) {
  console.log("❌ Error occurred. Asking GPT for advice...");

  const prompt = `
A JavaScript automation job threw an error.

Error: ${err.message}
Stack: ${err.stack}

Context: ${JSON.stringify(context, null, 2)}

What would be a safe and robust fix or improvement?
  `;

  const suggestion = await getFixSuggestion(prompt);
  console.log("🤖 GPT Suggestion:\n", suggestion);
}

module.exports = { handleError };
