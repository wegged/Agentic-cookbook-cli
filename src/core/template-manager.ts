import * as path from "path";
import * as os from "os";
import * as fs from "fs-extra";
import simpleGit, { SimpleGit } from "simple-git";
import glob from "fast-glob";
import * as yaml from "js-yaml";
import { TemplateMetadata } from "../types";

/**
 * TemplateManager handles template repository operations
 *
 * Manages cloning, updating, and reading from template repositories
 */
export class TemplateManager {
  private cacheDir: string;
  private git: SimpleGit;

  constructor(cacheDir: string = ".agent-cookbook-cache") {
    this.cacheDir = path.join(os.homedir(), cacheDir);
    this.git = simpleGit();
  }

  /**
   * Clone or update the template repository
   *
   * @param repoUrl - Git repository URL
   * @param branch - Branch to checkout (default: main)
   * @throws Error if git operations fail
   */
  async syncRepository(repoUrl: string, branch: string = "main"): Promise<void> {
    const repoPath = this.getRepoPath(repoUrl);

    if (await this.repoExists(repoPath)) {
      // Update existing repo
      const repoGit = simpleGit(repoPath);
      await repoGit.fetch();
      await repoGit.checkout(branch);
      await repoGit.pull("origin", branch);
    } else {
      // Clone new repo
      await fs.ensureDir(this.cacheDir);
      await this.git.clone(repoUrl, repoPath, ["--branch", branch]);
    }
  }

  /**
   * Read a template file from the cache
   *
   * @param repoUrl - Git repository URL
   * @param templatePath - Path to template file within repository
   * @returns Template file contents
   * @throws Error if template not found
   */
  async readTemplate(repoUrl: string, templatePath: string): Promise<string> {
    const repoPath = this.getRepoPath(repoUrl);
    const fullPath = path.join(repoPath, templatePath);

    if (!(await fs.pathExists(fullPath))) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    return await fs.readFile(fullPath, "utf-8");
  }

  /**
   * Get all available templates from repository
   *
   * @param repoUrl - Git repository URL
   * @returns Array of template file paths
   */
  async listTemplates(repoUrl: string): Promise<string[]> {
    const repoPath = this.getRepoPath(repoUrl);
    const files = await glob("**/*.md", {
      cwd: repoPath,
      ignore: ["node_modules/**", ".git/**"],
    });
    return files;
  }

  /**
   * Load template metadata from repository
   *
   * @param repoUrl - Git repository URL
   * @returns Template metadata or default if not found
   */
  async loadMetadata(repoUrl: string): Promise<TemplateMetadata> {
    const metadataPath = path.join(
      this.getRepoPath(repoUrl),
      ".agentcookbook-templates.yaml"
    );

    if (await fs.pathExists(metadataPath)) {
      const content = await fs.readFile(metadataPath, "utf-8");
      return yaml.load(content) as TemplateMetadata;
    }

    return { version: "1.0.0", templates: [] };
  }

  /**
   * Get the local path where repository is cached
   *
   * @param repoUrl - Git repository URL
   * @returns Local file system path
   */
  getRepoPath(repoUrl: string): string {
    const repoName = path.basename(repoUrl, ".git");
    return path.join(this.cacheDir, repoName);
  }

  /**
   * Check if repository exists in cache
   *
   * @param repoPath - Local repository path
   * @returns True if repository exists
   */
  private async repoExists(repoPath: string): Promise<boolean> {
    return await fs.pathExists(path.join(repoPath, ".git"));
  }

  /**
   * Clear the template cache
   *
   * @param repoUrl - Optional: specific repo to clear, or all if not specified
   */
  async clearCache(repoUrl?: string): Promise<void> {
    if (repoUrl) {
      const repoPath = this.getRepoPath(repoUrl);
      await fs.remove(repoPath);
    } else {
      await fs.remove(this.cacheDir);
    }
  }

  /**
   * Check if template exists in repository
   *
   * @param repoUrl - Git repository URL
   * @param templatePath - Path to template file
   * @returns True if template exists
   */
  async templateExists(repoUrl: string, templatePath: string): Promise<boolean> {
    const repoPath = this.getRepoPath(repoUrl);
    const fullPath = path.join(repoPath, templatePath);
    return await fs.pathExists(fullPath);
  }
}
