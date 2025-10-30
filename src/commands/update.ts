import * as fs from "fs-extra";
import * as path from "path";
import { UpdateOptions } from "../types";
import { ConfigLoader } from "../core/config-loader";
import { TemplateManager } from "../core/template-manager";
import { PathResolver } from "../core/path-resolver";
import { TemplateMerger } from "../core/merger";
import { Logger } from "../utils/logger";

/**
 * Update command - Pull latest templates and merge with project-specific content
 */
export async function updateCommand(
  templates: string[],
  options: UpdateOptions
): Promise<void> {
  try {
    Logger.header("Updating Agent Cookbook Templates");

    const configLoader = new ConfigLoader();

    // Check if config exists
    if (!(await configLoader.exists())) {
      Logger.error(
        "No configuration found. Run 'agent-cookbook init' first."
      );
      process.exit(1);
    }

    const config = await configLoader.load();

    // Sync template repository
    Logger.step("Fetching latest templates");
    const stopLoading = Logger.loading("Updating repository...");

    const templateManager = new TemplateManager();
    try {
      await templateManager.syncRepository(
        config.repository.url,
        config.repository.branch
      );
      stopLoading();
      Logger.success("Template repository updated");
    } catch (error: any) {
      stopLoading();
      Logger.error(`Failed to update repository: ${error.message}`);
      process.exit(1);
    }

    // Filter mappings if specific templates requested
    let mappingsToUpdate = config.mappings;
    if (templates.length > 0) {
      mappingsToUpdate = config.mappings.filter((m) =>
        templates.includes(m.name)
      );
      if (mappingsToUpdate.length === 0) {
        Logger.error(`No mappings found matching: ${templates.join(", ")}`);
        process.exit(1);
      }
    }

    // Update AGENTS.md files
    Logger.step("Updating AGENTS.md files");

    const pathResolver = new PathResolver(config.variables);
    const merger = new TemplateMerger(config.merge.delimiter);

    let updatedCount = 0;
    let noChangeCount = 0;
    let createdCount = 0;
    let conflictCount = 0;
    const conflicts: string[] = [];

    for (const mapping of mappingsToUpdate) {
      try {
        // Resolve target path
        const resolved = pathResolver.resolvePath(mapping.targetPath);

        // Read new template
        const newTemplate = await templateManager.readTemplate(
          config.repository.url,
          mapping.template
        );

        // Check if file exists locally
        if (await fs.pathExists(resolved.resolved)) {
          // File exists - merge
          const existingContent = await fs.readFile(
            resolved.resolved,
            "utf-8"
          );

          if (options.force) {
            // Force overwrite
            if (options.dryRun) {
              Logger.info(
                `Would overwrite: ${Logger.formatPath(resolved.resolved)}`
              );
            } else {
              await fs.writeFile(
                resolved.resolved,
                merger.ensureDelimiter(newTemplate),
                "utf-8"
              );
              Logger.success(
                `Overwritten ${Logger.formatPath(resolved.resolved)}`
              );
            }
            updatedCount++;
          } else {
            // Smart merge
            const templateSection = merger.getTemplateSection(newTemplate);
            const existingTemplateSection =
              merger.getTemplateSection(existingContent);

            if (!merger.hasChanges(templateSection, existingTemplateSection)) {
              Logger.info(
                `No changes: ${Logger.formatPath(resolved.resolved)}`
              );
              noChangeCount++;
            } else {
              const mergeResult = merger.merge(
                newTemplate,
                existingContent,
                config.merge.strategy
              );

              if (mergeResult.hasConflict) {
                Logger.warning(
                  `Conflict detected: ${Logger.formatPath(resolved.resolved)}`
                );
                conflicts.push(resolved.resolved);
                conflictCount++;
              } else {
                if (options.dryRun) {
                  Logger.info(
                    `Would update: ${Logger.formatPath(resolved.resolved)}`
                  );
                } else {
                  await fs.writeFile(
                    resolved.resolved,
                    mergeResult.content,
                    "utf-8"
                  );
                  Logger.success(
                    `Updated ${Logger.formatPath(resolved.resolved)}`
                  );
                }
                updatedCount++;
              }
            }
          }
        } else {
          // File doesn't exist - create it
          await fs.ensureDir(path.dirname(resolved.resolved));

          if (options.dryRun) {
            Logger.info(
              `Would create: ${Logger.formatPath(resolved.resolved)}`
            );
          } else {
            await fs.writeFile(
              resolved.resolved,
              merger.ensureDelimiter(newTemplate),
              "utf-8"
            );
            Logger.success(`Created ${Logger.formatPath(resolved.resolved)}`);
          }
          createdCount++;
        }
      } catch (error: any) {
        Logger.error(
          `Failed to update ${mapping.name}: ${error.message}`
        );
      }
    }

    // Summary
    Logger.newline();
    if (options.dryRun) {
      Logger.header("Dry Run Summary");
      Logger.info(
        `Would update ${Logger.formatCount(updatedCount)} files`
      );
      Logger.info(
        `Would create ${Logger.formatCount(createdCount)} files`
      );
      Logger.info(`${Logger.formatCount(noChangeCount)} files unchanged`);
    } else {
      Logger.header("Update Summary");
      Logger.success(`Updated ${Logger.formatCount(updatedCount)} files`);
      if (createdCount > 0) {
        Logger.success(`Created ${Logger.formatCount(createdCount)} files`);
      }
      if (noChangeCount > 0) {
        Logger.info(`${Logger.formatCount(noChangeCount)} files unchanged`);
      }

      if (conflictCount > 0) {
        Logger.newline();
        Logger.warning(
          `${Logger.formatCount(conflictCount)} conflicts require manual review:`
        );
        conflicts.forEach((file) => {
          Logger.listItem(Logger.formatPath(file), 1);
        });
        Logger.newline();
        Logger.info("Resolve conflicts manually and re-run update");
      }
    }
  } catch (error: any) {
    Logger.error(`Update failed: ${error.message}`);
    process.exit(1);
  }
}
