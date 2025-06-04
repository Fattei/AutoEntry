// github-client.js
require('dotenv').config();
let octokit;

async function getOctokitInstance() {
  if (!octokit) {
    const { Octokit } = await import("@octokit/rest");
    octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  }
  return octokit;
}

async function listReposForUser(username) {
  try {
    const client = await getOctokitInstance();
    const repos = await client.repos.listForUser({ username });
    return repos.data;
  } catch (error) {
    console.error("GitHub API Error:", error);
    throw error;
  }
}

async function getRepoContents(owner, repo, path = "") {
  try {
    const client = await getOctokitInstance();
    const contents = await client.repos.getContent({
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
