import * as fs from "fs-extra";
import * as path from "path";
import inquirer from "inquirer";
import { InitOptions } from "../types";
import { ConfigLoader } from "../core/config-loader";
import { TemplateManager } from "../core/template-manager";
import { PathResolver } from "../core/path-resolver";
import { TemplateMerger } from "../core/merger";
import { Logger } from "../utils/logger";

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

    // Sync template repository
    Logger.step("Downloading templates from repository");
    const stopLoading = Logger.loading("Cloning repository...");

    const templateManager = new TemplateManager();
    try {
      await templateManager.syncRepository(repoUrl);
      stopLoading();
      Logger.success("Templates downloaded");
    } catch (error: any) {
      stopLoading();
      Logger.error(`Failed to clone repository: ${error.message}`);
      process.exit(1);
    }

    // Load configuration (now with defaults)
    const config = await configLoader.load();

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

        // Read template
        const templateContent = await templateManager.readTemplate(
          config.repository.url,
          mapping.template
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
