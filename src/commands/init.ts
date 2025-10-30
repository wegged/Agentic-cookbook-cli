import * as fs from "fs-extra";
import * as path from "path";
import inquirer from "inquirer";
import { InitOptions } from "../types";
import { ConfigLoader } from "../core/config-loader";
import { TemplateManager } from "../core/template-manager";
import { PathResolver } from "../core/path-resolver";
import { TemplateMerger } from "../core/merger";
import { Logger } from "../utils/logger";
import { FileCopyOptions } from "../core/file-copier";

/**
 * Initialize command - Set up project with AGENTS.md files
 */
export async function initCommand(options: InitOptions): Promise<void> {
  try {
    Logger.header("Initializing Agent Cookbook");

    const configLoader = new ConfigLoader();

    // Check if config already exists
    if (await configLoader.exists()) {
      if (!options.force) {
        Logger.error(
          "Configuration already exists. Use --force to overwrite."
        );
        process.exit(1);
      }
      Logger.warning("Overwriting existing configuration");
    }

    let repoUrl = options.repo;
    let variables: { [key: string]: string } = {};

    // Interactive setup if needed
    if (options.interactive || !repoUrl) {
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "repoUrl",
          message: "Enter template repository URL:",
          default: repoUrl,
          validate: (input: string) => {
            if (!input) return "Repository URL is required";
            return true;
          },
        },
        {
          type: "input",
          name: "appName",
          message: "Enter application name (for {{appName}} variable):",
          default: path.basename(process.cwd()),
        },
        {
          type: "input",
          name: "namespace",
          message: "Enter namespace (for {{namespace}} variable, optional):",
        },
        {
          type: "input",
          name: "apiVersion",
          message: "Enter API version (for {{apiVersion}} variable, optional):",
          default: "v1",
        },
      ]);

      repoUrl = answers.repoUrl;
      if (answers.appName) variables.appName = answers.appName;
      if (answers.namespace) variables.namespace = answers.namespace;
      if (answers.apiVersion) variables.apiVersion = answers.apiVersion;
    }

    if (!repoUrl) {
      Logger.error("Repository URL is required");
      process.exit(1);
    }

    // Create configuration
    Logger.step("Creating configuration file");
    await configLoader.create(repoUrl, variables);
    Logger.success(`Configuration saved to ${configLoader.getConfigPath()}`);

    // Load configuration (now with defaults)
    const config = await configLoader.load();

    // Collect all unique branches from mappings
    const branches = new Set<string>();
    branches.add(config.repository.branch); // Always include default branch
    for (const mapping of config.mappings) {
      if (mapping.branch) {
        branches.add(mapping.branch);
      }
    }

    // Sync template repository for each branch
    Logger.step("Downloading templates from repository");
    const templateManager = new TemplateManager();

    for (const branch of Array.from(branches)) {
      const stopLoading = Logger.loading(`Cloning repository (branch: ${branch})...`);
      try {
        await templateManager.syncRepository(repoUrl, branch);
        stopLoading();
        Logger.success(`Templates downloaded from branch: ${branch}`);
      } catch (error: any) {
        stopLoading();
        Logger.error(`Failed to clone repository branch ${branch}: ${error.message}`);
        process.exit(1);
      }
    }

    // If no mappings defined, prompt to create some
    if (config.mappings.length === 0) {
      Logger.warning("No template mappings defined in configuration");
      Logger.info(
        "Edit .agentcookbook.yaml to add template mappings, then run this command again"
      );
      return;
    }

    // Create AGENTS.md files
    Logger.step("Creating AGENTS.md files");

    const pathResolver = new PathResolver(config.variables);
    const merger = new TemplateMerger(config.merge.delimiter);
    let createdCount = 0;
    let skippedCount = 0;

    for (const mapping of config.mappings) {
      try {
        // Determine which branch to use for this mapping
        const branch = mapping.branch || config.repository.branch;

        // Check if this is a folder mapping
        const isFolder = mapping.type === "folder";

        if (isFolder) {
          // Handle folder mapping
          const fileCopyOptions: FileCopyOptions = {
            recursive: mapping.recursive !== false,
            preserveStructure: mapping.preserveStructure !== false,
            include: mapping.include || ["**/AGENTS.md", "**/AGENTS.*"],
            exclude: mapping.exclude || ["**/node_modules/**", "**/.git/**"],
          };

          // Get list of files from template folder
          const templateFiles = await templateManager.listFolderFiles(
            config.repository.url,
            mapping.template,
            branch,
            fileCopyOptions
          );

          if (templateFiles.length === 0) {
            Logger.warning(
              `No files found in template folder: ${mapping.template}`
            );
            continue;
          }

          // Process each file in the folder
          for (const relativeFilePath of templateFiles) {
            // Resolve target base path
            const resolvedBase = pathResolver.resolvePath(mapping.targetPath);

            // Build target path preserving structure
            const targetPath = path.join(
              resolvedBase.resolved,
              relativeFilePath
            );

            // Check if file already exists
            if (await fs.pathExists(targetPath)) {
              if (!options.force) {
                Logger.warning(
                  `Skipping ${Logger.formatPath(targetPath)} (already exists)`
                );
                skippedCount++;
                continue;
              }
            }

            // Read template file content
            const templateFilePath = path.join(mapping.template, relativeFilePath);
            const templateContent = await templateManager.readTemplate(
              config.repository.url,
              templateFilePath,
              branch
            );

            // Ensure delimiter is present
            const contentWithDelimiter = merger.ensureDelimiter(templateContent);

            // Create directory if needed
            await fs.ensureDir(path.dirname(targetPath));

            // Write file
            if (options.dryRun) {
              Logger.info(`Would create: ${Logger.formatPath(targetPath)}`);
            } else {
              await fs.writeFile(targetPath, contentWithDelimiter, "utf-8");
              Logger.success(`Created ${Logger.formatPath(targetPath)}`);
            }

            createdCount++;
          }
        } else {
          // Handle single file mapping (default behavior)
          // Resolve target path
          const resolved = pathResolver.resolvePath(mapping.targetPath);

          // Check if file already exists
          if (await fs.pathExists(resolved.resolved)) {
            if (!options.force) {
              Logger.warning(
                `Skipping ${Logger.formatPath(resolved.resolved)} (already exists)`
              );
              skippedCount++;
              continue;
            }
          }

          // Read template from the appropriate branch
          const templateContent = await templateManager.readTemplate(
            config.repository.url,
            mapping.template,
            branch
          );

          // Ensure delimiter is present
          const contentWithDelimiter = merger.ensureDelimiter(templateContent);

          // Create directory if needed
          await fs.ensureDir(path.dirname(resolved.resolved));

          // Write file
          if (options.dryRun) {
            Logger.info(`Would create: ${Logger.formatPath(resolved.resolved)}`);
          } else {
            await fs.writeFile(resolved.resolved, contentWithDelimiter, "utf-8");
            Logger.success(`Created ${Logger.formatPath(resolved.resolved)}`);
          }

          createdCount++;
        }
      } catch (error: any) {
        Logger.error(
          `Failed to create ${mapping.name}: ${error.message}`
        );
      }
    }

    // Summary
    Logger.newline();
    if (options.dryRun) {
      Logger.info(
        `Would create ${Logger.formatCount(createdCount)} AGENTS.md files`
      );
    } else {
      Logger.success(
        `Created ${Logger.formatCount(createdCount)} AGENTS.md files`
      );
      if (skippedCount > 0) {
        Logger.info(`Skipped ${Logger.formatCount(skippedCount)} existing files`);
      }
    }
  } catch (error: any) {
    Logger.error(`Initialization failed: ${error.message}`);
    process.exit(1);
  }
}
