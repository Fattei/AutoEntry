const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const githubClient = require('./github-client'); // your GitHub API client module

const git = simpleGit();

async function runExample() {
  try {
    // 1. Get repo contents using GitHub API client
    const repoOwner = 'Fattei';          // replace with your GitHub username/org
    const repoName = 'AutoEntry';        // your repo name

    console.log(`Fetching root contents for ${repoOwner}/${repoName}...`);
    const contents = await githubClient.getRepoContents(repoOwner, repoName);
    console.log('Repo root contents:', contents.map(item => item.name));

    // 2. Create or modify a local file (example: add timestamp to a log file)
    const filePath = path.resolve(__dirname, 'example-log.txt');
    const logEntry = `Update at ${new Date().toISOString()}\n`;

    fs.appendFileSync(filePath, logEntry);
    console.log(`Appended to ${filePath}:`, logEntry.trim());

    // 3. Stage, commit, and push changes using simple-git
    await git.add(filePath);
    await git.commit(`Automated commit: Added log entry at ${new Date().toISOString()}`);
    console.log('Committed changes.');

    // Push to remote 'main' branch (make sure upstream is set)
    await git.push('origin', 'main');
    console.log('Pushed changes to remote repository.');

  } catch (error) {
    console.error('Error in GitHub + git integration:', error);
  }
}

// Run the example when this module is called directly
if (require.main === module) {
  runExample();
}

module.exports = { runExample };
