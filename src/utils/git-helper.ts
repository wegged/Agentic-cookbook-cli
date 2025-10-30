import simpleGit, { SimpleGit } from "simple-git";
import { execSync } from "child_process";

/**
 * GitHelper provides utility functions for git operations
 */
export class GitHelper {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * Create a new branch
   *
   * @param branchName - Name of the branch to create
   * @param checkout - Whether to checkout the branch after creating it
   */
  async createBranch(branchName: string, checkout: boolean = true): Promise<void> {
    if (checkout) {
      await this.git.checkoutLocalBranch(branchName);
    } else {
      await this.git.branch([branchName]);
    }
  }

  /**
   * Checkout a branch
   *
   * @param branchName - Name of the branch to checkout
   */
  async checkout(branchName: string): Promise<void> {
    await this.git.checkout(branchName);
  }

  /**
   * Add files to staging area
   *
   * @param files - File paths to add (relative to repo root)
   */
  async addFiles(files: string[]): Promise<void> {
    await this.git.add(files);
  }

  /**
   * Commit staged changes
   *
   * @param message - Commit message
   */
  async commit(message: string): Promise<void> {
    await this.git.commit(message);
  }

  /**
   * Push branch to remote
   *
   * @param branchName - Branch to push
   * @param remote - Remote name (default: origin)
   * @param setUpstream - Whether to set upstream tracking
   */
  async pushBranch(
    branchName: string,
    remote: string = "origin",
    setUpstream: boolean = true
  ): Promise<void> {
    if (setUpstream) {
      await this.git.push(["-u", remote, branchName]);
    } else {
      await this.git.push(remote, branchName);
    }
  }

  /**
   * Check if a branch exists locally
   *
   * @param branchName - Branch name to check
   * @returns True if branch exists
   */
  async branchExists(branchName: string): Promise<boolean> {
    const branches = await this.git.branchLocal();
    return branches.all.includes(branchName);
  }

  /**
   * Get current branch name
   *
   * @returns Current branch name
   */
  async getCurrentBranch(): Promise<string> {
    const status = await this.git.status();
    return status.current || "";
  }

  /**
   * Check if working directory is clean
   *
   * @returns True if no uncommitted changes
   */
  async isClean(): Promise<boolean> {
    const status = await this.git.status();
    return status.isClean();
  }

  /**
   * Get remote URL
   *
   * @param remote - Remote name (default: origin)
   * @returns Remote URL
   */
  async getRemoteUrl(remote: string = "origin"): Promise<string> {
    const remotes = await this.git.getRemotes(true);
    const remoteObj = remotes.find((r) => r.name === remote);
    return remoteObj?.refs?.fetch || "";
  }

  /**
   * Check if gh CLI is available
   *
   * @returns True if gh CLI is installed
   */
  static isGhCliAvailable(): boolean {
    try {
      execSync("gh --version", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a pull request using gh CLI
   *
   * @param title - PR title
   * @param body - PR description
   * @param base - Base branch (default: main)
   * @param labels - PR labels
   * @param reviewers - PR reviewers
   * @returns PR URL
   */
  static createPullRequest(
    title: string,
    body: string,
    base: string = "main",
    labels: string[] = [],
    reviewers: string[] = []
  ): string {
    const args = ["pr", "create", "--title", title, "--body", body, "--base", base];

    if (labels.length > 0) {
      args.push("--label", labels.join(","));
    }

    if (reviewers.length > 0) {
      args.push("--reviewer", reviewers.join(","));
    }

    try {
      const output = execSync(`gh ${args.join(" ")}`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Extract PR URL from output (gh CLI typically outputs the PR URL)
      const lines = output.trim().split("\n");
      const urlLine = lines.find((line) => line.includes("github.com"));
      return urlLine || output.trim();
    } catch (error: any) {
      throw new Error(`Failed to create PR: ${error.message}`);
    }
  }

  /**
   * Fetch from remote
   *
   * @param remote - Remote name (default: origin)
   */
  async fetch(remote: string = "origin"): Promise<void> {
    await this.git.fetch(remote);
  }

  /**
   * Pull from remote
   *
   * @param remote - Remote name (default: origin)
   * @param branch - Branch name
   */
  async pull(remote: string = "origin", branch?: string): Promise<void> {
    if (branch) {
      await this.git.pull(remote, branch);
    } else {
      await this.git.pull();
    }
  }

  /**
   * Delete a local branch
   *
   * @param branchName - Branch to delete
   * @param force - Force deletion
   */
  async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
    if (force) {
      await this.git.branch(["-D", branchName]);
    } else {
      await this.git.branch(["-d", branchName]);
    }
  }

  /**
   * Get list of changed files
   *
   * @returns Array of changed file paths
   */
  async getChangedFiles(): Promise<string[]> {
    const status = await this.git.status();
    return [
      ...status.modified,
      ...status.created,
      ...status.deleted,
      ...status.renamed.map((r) => r.to),
    ];
  }
}
