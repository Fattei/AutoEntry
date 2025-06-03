const simpleGit = require('simple-git');
const path = require('path');

class VersionControl {
  constructor(repoPath = process.cwd()) {
    this.git = simpleGit(repoPath);
  }

  async init() {
    try {
      await this.git.init();
      console.log('Git repository initialized.');
    } catch (error) {
      console.error('Error initializing git repo:', error);
    }
  }

  async add(files = ['.']) {
    try {
      await this.git.add(files);
      console.log(`Added files to staging: ${files}`);
    } catch (error) {
      console.error('Error adding files:', error);
    }
  }

  async commit(message = 'Automated commit') {
    try {
      const commitSummary = await this.git.commit(message);
      console.log('Commit successful:', commitSummary);
    } catch (error) {
      console.error('Error committing files:', error);
    }
  }

  async push(remote = 'origin', branch = 'main') {
    try {
      await this.git.push(remote, branch);
      console.log(`Pushed to ${remote}/${branch}`);
    } catch (error) {
      console.error('Error pushing to remote:', error);
    }
  }

  async status() {
    try {
      const statusSummary = await this.git.status();
      return statusSummary;
    } catch (error) {
      console.error('Error getting git status:', error);
    }
  }
}

module.exports = VersionControl;
