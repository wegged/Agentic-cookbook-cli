import * as fs from "fs-extra";
import { SyncOptions } from "../types";
import { ConfigLoader } from "../core/config-loader";
import { TemplateManager } from "../core/template-manager";
import { PathResolver } from "../core/path-resolver";
import { TemplateMerger } from "../core/merger";
import { Logger } from "../utils/logger";

/**
 * Sync command - Sync a specific template or check sync status
 */
export async function syncCommand(
  templateName: string | undefined,
  options: SyncOptions
): Promise<void> {
  try {
    Logger.header("Syncing Templates");

    const configLoader = new ConfigLoader();

    // Check if config exists
    if (!(await configLoader.exists())) {
      Logger.error(
        "No configuration found. Run 'agent-cookbook init' first."
      );
      process.exit(1);
    }

    const config = await configLoader.load();

    const pathResolver = new PathResolver(config.variables);
    const merger = new TemplateMerger(config.merge.delimiter);
    const templateManager = new TemplateManager();

    // Collect all unique branches from mappings
    const branches = new Set<string>();
    for (const mapping of config.mappings) {
      const branch = mapping.branch || config.repository.branch;
      branches.add(branch);
    }

    // Sync template repository for each branch (if not check-only)
    if (!options.checkOnly) {
      Logger.step("Fetching latest templates");

      for (const branch of Array.from(branches)) {
        const stopLoading = Logger.loading(`Updating repository (branch: ${branch})...`);
        try {
          await templateManager.syncRepository(
            config.repository.url,
            branch
          );
          stopLoading();
          Logger.success(`Template repository updated (branch: ${branch})`);
        } catch (error: any) {
          stopLoading();
          Logger.error(`Failed to update repository branch ${branch}: ${error.message}`);
          process.exit(1);
        }
      }
    }

    // Filter to specific template if requested
    let mappingsToCheck = config.mappings;
    if (templateName) {
      const mapping = config.mappings.find((m) => m.name === templateName);
      if (!mapping) {
        Logger.error(`Template not found: ${templateName}`);
        Logger.info("Available templates:");
        config.mappings.forEach((m) => Logger.listItem(m.name, 1));
        process.exit(1);
      }
      mappingsToCheck = [mapping];
    }

    // Check sync status
    Logger.step(
      options.checkOnly
        ? "Checking sync status"
        : "Checking which files need syncing"
    );

    let inSyncCount = 0;
    let outOfSyncCount = 0;
    let missingCount = 0;
    const outOfSync: string[] = [];

    for (const mapping of mappingsToCheck) {
      try {
        // Resolve target path
        const resolved = pathResolver.resolvePath(mapping.targetPath);

        // Check if file exists locally
        if (!(await fs.pathExists(resolved.resolved))) {
          Logger.warning(`Missing: ${Logger.formatPath(resolved.resolved)}`);
          missingCount++;
          outOfSync.push(resolved.resolved);
          continue;
        }

        // Determine which branch to use for this mapping
        const branch = mapping.branch || config.repository.branch;

        // Read both local and template content
        const localContent = await fs.readFile(resolved.resolved, "utf-8");
        const templateContent = await templateManager.readTemplate(
          config.repository.url,
          mapping.template,
          branch
        );

        // Compare template sections only
        const localTemplateSection = merger.getTemplateSection(localContent);
        const repoTemplateSection = merger.getTemplateSection(templateContent);

        if (merger.hasChanges(localTemplateSection, repoTemplateSection)) {
          Logger.warning(`Out of sync: ${Logger.formatPath(resolved.resolved)}`);
          outOfSyncCount++;
          outOfSync.push(resolved.resolved);
        } else {
          Logger.success(`In sync: ${Logger.formatPath(resolved.resolved)}`);
          inSyncCount++;
        }
      } catch (error: any) {
        Logger.error(
          `Failed to check ${mapping.name}: ${error.message}`
        );
      }
    }

    // Summary
    Logger.newline();
    Logger.header("Sync Status");
    Logger.success(`${Logger.formatCount(inSyncCount)} files in sync`);

    if (outOfSyncCount > 0) {
      Logger.warning(
        `${Logger.formatCount(outOfSyncCount)} files out of sync`
      );
    }

    if (missingCount > 0) {
      Logger.warning(`${Logger.formatCount(missingCount)} files missing`);
    }

    if (options.checkOnly) {
      if (outOfSyncCount > 0 || missingCount > 0) {
        Logger.newline();
        Logger.info("Run 'agent-cookbook update' to sync files");
        process.exit(1); // Exit with error code for CI/CD
      }
    } else {
      if (outOfSync.length > 0 && !options.force) {
        Logger.newline();
        Logger.info("Files that need syncing:");
        outOfSync.forEach((file) => Logger.listItem(Logger.formatPath(file), 1));
        Logger.newline();
        Logger.info("Run 'agent-cookbook update' to sync these files");
      }
    }
  } catch (error: any) {
    Logger.error(`Sync failed: ${error.message}`);
    process.exit(1);
  }
}
