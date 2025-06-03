const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates a GPT-based suggestion for an error.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
module.exports = async function getFixSuggestion(prompt) {
  const res = await openai.chat.completions.create({
    model: "gpt-3.5-turbo", // change to gpt-3.5-turbo if needed
    messages: [
      {
        role: "system",
        content: "You are a senior software engineer helping debug JavaScript automation scripts. Respond with practical code suggestions only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return res.choices[0].message.content;
};
