import * as path from "path";
import * as fs from "fs-extra";
import glob from "fast-glob";

/**
 * Options for copying files and folders
 */
export interface FileCopyOptions {
  recursive?: boolean;
  preserveStructure?: boolean;
  include?: string[];
  exclude?: string[];
}

/**
 * Represents a file to be copied
 */
export interface FileMapping {
  sourcePath: string; // Absolute path in template
  relativePath: string; // Relative path from template root
  targetPath: string; // Absolute path in project
}

/**
 * FileCopier handles recursive file and folder operations
 *
 * Supports copying entire folder structures with glob pattern filtering
 */
export class FileCopier {
  /**
   * Find all files in a folder that match the given patterns
   *
   * @param folderPath - Absolute path to the folder to search
   * @param options - Copy options with include/exclude patterns
   * @returns Array of absolute file paths
   */
  async findFiles(
    folderPath: string,
    options: FileCopyOptions = {}
  ): Promise<string[]> {
    const {
      recursive = true,
      include = ["**/*"],
      exclude = ["**/node_modules/**", "**/.git/**"],
    } = options;

    // Build glob patterns
    const patterns = recursive ? include : include.map((p) => p.replace("**/", ""));

    // Find all matching files
    const files = await glob(patterns, {
      cwd: folderPath,
      ignore: exclude,
      onlyFiles: true,
      dot: false,
      absolute: true,
    });

    return files;
  }

  /**
   * Find all AGENTS.md files in a folder recursively
   *
   * @param folderPath - Absolute path to the folder to search
   * @param options - Copy options with additional filters
   * @returns Array of absolute file paths
   */
  async findAgentsFiles(
    folderPath: string,
    options: FileCopyOptions = {}
  ): Promise<string[]> {
    const agentsOptions: FileCopyOptions = {
      ...options,
      include: ["**/AGENTS.md", "**/AGENTS.*"],
    };

    return this.findFiles(folderPath, agentsOptions);
  }

  /**
   * Create file mappings for copying a folder structure
   *
   * @param sourceFolder - Absolute path to source folder
   * @param targetFolder - Absolute path to target folder
   * @param options - Copy options
   * @returns Array of file mappings
   */
  async createFileMappings(
    sourceFolder: string,
    targetFolder: string,
    options: FileCopyOptions = {}
  ): Promise<FileMapping[]> {
    const files = await this.findFiles(sourceFolder, options);
    const mappings: FileMapping[] = [];

    for (const sourcePath of files) {
      // Calculate relative path from source folder
      const relativePath = path.relative(sourceFolder, sourcePath);

      // Calculate target path
      let targetPath: string;
      if (options.preserveStructure !== false) {
        // Preserve directory structure
        targetPath = path.join(targetFolder, relativePath);
      } else {
        // Flatten structure
        targetPath = path.join(targetFolder, path.basename(sourcePath));
      }

      mappings.push({
        sourcePath,
        relativePath,
        targetPath,
      });
    }

    return mappings;
  }

  /**
   * Copy files from source to target based on mappings
   *
   * @param mappings - Array of file mappings
   * @param overwrite - Whether to overwrite existing files
   * @returns Array of target paths that were copied
   */
  async copyFiles(
    mappings: FileMapping[],
    overwrite: boolean = false
  ): Promise<string[]> {
    const copiedFiles: string[] = [];

    for (const mapping of mappings) {
      // Check if target already exists
      if (!overwrite && (await fs.pathExists(mapping.targetPath))) {
        continue;
      }

      // Ensure target directory exists
      await fs.ensureDir(path.dirname(mapping.targetPath));

      // Copy file
      await fs.copyFile(mapping.sourcePath, mapping.targetPath);
      copiedFiles.push(mapping.targetPath);
    }

    return copiedFiles;
  }

  /**
   * Copy folder structure from source to target
   *
   * @param sourceFolder - Absolute path to source folder
   * @param targetFolder - Absolute path to target folder
   * @param options - Copy options
   * @param overwrite - Whether to overwrite existing files
   * @returns Array of target paths that were copied
   */
  async copyFolder(
    sourceFolder: string,
    targetFolder: string,
    options: FileCopyOptions = {},
    overwrite: boolean = false
  ): Promise<string[]> {
    const mappings = await this.createFileMappings(
      sourceFolder,
      targetFolder,
      options
    );
    return this.copyFiles(mappings, overwrite);
  }

  /**
   * Read all files from a folder based on options
   *
   * @param folderPath - Absolute path to the folder to search
   * @param options - Copy options with include/exclude patterns
   * @returns Map of relative path to file content
   */
  async readFolder(
    folderPath: string,
    options: FileCopyOptions = {}
  ): Promise<Map<string, string>> {
    const files = await this.findFiles(folderPath, options);
    const contents = new Map<string, string>();

    for (const filePath of files) {
      const relativePath = path.relative(folderPath, filePath);
      const content = await fs.readFile(filePath, "utf-8");
      contents.set(relativePath, content);
    }

    return contents;
  }

  /**
   * Check if a path is a folder
   *
   * @param folderPath - Path to check
   * @returns True if path exists and is a directory
   */
  async isFolder(folderPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(folderPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}
