import * as path from "path";
import * as os from "os";
import * as fs from "fs-extra";
import simpleGit, { SimpleGit } from "simple-git";
import glob from "fast-glob";
import * as yaml from "js-yaml";
import { TemplateMetadata } from "../types";
import { FileCopier, FileCopyOptions } from "./file-copier";

/**
 * TemplateManager handles template repository operations
 *
 * Manages cloning, updating, and reading from template repositories
 */
export class TemplateManager {
  private cacheDir: string;
  private git: SimpleGit;
  private fileCopier: FileCopier;

  constructor(cacheDir: string = ".agent-cookbook-cache") {
    this.cacheDir = path.join(os.homedir(), cacheDir);
    this.git = simpleGit();
    this.fileCopier = new FileCopier();
  }

  /**
   * Clone or update the template repository
   *
   * @param repoUrl - Git repository URL
   * @param branch - Branch to checkout (default: main)
   * @throws Error if git operations fail
   */
  async syncRepository(repoUrl: string, branch: string = "main"): Promise<void> {
    const repoPath = this.getRepoPath(repoUrl, branch);

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
   * @param branch - Branch to read from (default: main)
   * @returns Template file contents
   * @throws Error if template not found
   */
  async readTemplate(
    repoUrl: string,
    templatePath: string,
    branch: string = "main"
  ): Promise<string> {
    const repoPath = this.getRepoPath(repoUrl, branch);
    const fullPath = path.join(repoPath, templatePath);

    if (!(await fs.pathExists(fullPath))) {
      throw new Error(`Template not found: ${templatePath} (branch: ${branch})`);
    }

    return await fs.readFile(fullPath, "utf-8");
  }

  /**
   * Get all available templates from repository
   *
   * @param repoUrl - Git repository URL
   * @param branch - Branch to list from (default: main)
   * @returns Array of template file paths
   */
  async listTemplates(repoUrl: string, branch: string = "main"): Promise<string[]> {
    const repoPath = this.getRepoPath(repoUrl, branch);
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
   * @param branch - Branch to load metadata from (default: main)
   * @returns Template metadata or default if not found
   */
  async loadMetadata(repoUrl: string, branch: string = "main"): Promise<TemplateMetadata> {
    const metadataPath = path.join(
      this.getRepoPath(repoUrl, branch),
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
   * @param branch - Branch name (optional, for branch-specific caching)
   * @returns Local file system path
   */
  getRepoPath(repoUrl: string, branch?: string): string {
    const repoName = path.basename(repoUrl, ".git");
    if (branch) {
      // Branch-specific cache: .agent-cookbook-cache/repo-name/branch-name/
      const safeBranchName = branch.replace(/[^a-zA-Z0-9-_.]/g, "-");
      return path.join(this.cacheDir, repoName, safeBranchName);
    }
    // Legacy compatibility: .agent-cookbook-cache/repo-name/
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
   * @param branch - Branch to check (default: main)
   * @returns True if template exists
   */
  async templateExists(
    repoUrl: string,
    templatePath: string,
    branch: string = "main"
  ): Promise<boolean> {
    const repoPath = this.getRepoPath(repoUrl, branch);
    const fullPath = path.join(repoPath, templatePath);
    return await fs.pathExists(fullPath);
  }

  /**
   * Get the absolute path to a template folder
   *
   * @param repoUrl - Git repository URL
   * @param templatePath - Path to template folder within repository
   * @param branch - Branch to read from (default: main)
   * @returns Absolute path to the template folder
   */
  getTemplatePath(
    repoUrl: string,
    templatePath: string,
    branch: string = "main"
  ): string {
    const repoPath = this.getRepoPath(repoUrl, branch);
    return path.join(repoPath, templatePath);
  }

  /**
   * Check if a template path is a folder
   *
   * @param repoUrl - Git repository URL
   * @param templatePath - Path to template within repository
   * @param branch - Branch to check (default: main)
   * @returns True if path exists and is a directory
   */
  async isTemplateFolder(
    repoUrl: string,
    templatePath: string,
    branch: string = "main"
  ): Promise<boolean> {
    const fullPath = this.getTemplatePath(repoUrl, templatePath, branch);
    return await this.fileCopier.isFolder(fullPath);
  }

  /**
   * List all files in a template folder
   *
   * @param repoUrl - Git repository URL
   * @param templatePath - Path to template folder within repository
   * @param branch - Branch to read from (default: main)
   * @param options - File copy options for filtering
   * @returns Array of relative file paths from the template folder
   */
  async listFolderFiles(
    repoUrl: string,
    templatePath: string,
    branch: string = "main",
    options?: FileCopyOptions
  ): Promise<string[]> {
    const fullPath = this.getTemplatePath(repoUrl, templatePath, branch);
    const absolutePaths = await this.fileCopier.findFiles(fullPath, options);

    // Convert to relative paths
    return absolutePaths.map((absPath) => path.relative(fullPath, absPath));
  }

  /**
   * Read all files from a template folder
   *
   * @param repoUrl - Git repository URL
   * @param templatePath - Path to template folder within repository
   * @param branch - Branch to read from (default: main)
   * @param options - File copy options for filtering
   * @returns Map of relative path to file content
   */
  async readTemplateFolder(
    repoUrl: string,
    templatePath: string,
    branch: string = "main",
    options?: FileCopyOptions
  ): Promise<Map<string, string>> {
    const fullPath = this.getTemplatePath(repoUrl, templatePath, branch);
    return await this.fileCopier.readFolder(fullPath, options);
  }

  /**
   * Find all AGENTS.md files in a template folder
   *
   * @param repoUrl - Git repository URL
   * @param templatePath - Path to template folder within repository
   * @param branch - Branch to read from (default: main)
   * @param options - Additional file copy options
   * @returns Array of relative file paths
   */
  async listAgentsFiles(
    repoUrl: string,
    templatePath: string,
    branch: string = "main",
    options?: FileCopyOptions
  ): Promise<string[]> {
    const fullPath = this.getTemplatePath(repoUrl, templatePath, branch);
    const absolutePaths = await this.fileCopier.findAgentsFiles(fullPath, options);

    // Convert to relative paths
    return absolutePaths.map((absPath) => path.relative(fullPath, absPath));
  }
}
