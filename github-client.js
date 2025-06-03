const { Octokit } = require("@octokit/rest");

// Use a GitHub token with repo access stored in env
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function listReposForUser(username) {
  try {
    const repos = await octokit.repos.listForUser({ username });
    return repos.data;
  } catch (error) {
    console.error("GitHub API Error:", error);
    throw error;
  }
}

async function getRepoContents(owner, repo, path = "") {
  try {
    const contents = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });
    return contents.data;
  } catch (error) {
    console.error("GitHub API Error:", error);
    throw error;
  }
}

module.exports = {
  listReposForUser,
  getRepoContents,
};
