import * as fs from "fs-extra";
import * as path from "path";
import { ProposeOptions } from "../types";
import { ConfigLoader } from "../core/config-loader";
import { TemplateManager } from "../core/template-manager";
import { PathResolver } from "../core/path-resolver";
import { TemplateMerger } from "../core/merger";
import { GitHelper } from "../utils/git-helper";
import { Logger } from "../utils/logger";

/**
 * Propose command - Push modified template sections back to template repository
 */
export async function proposeCommand(options: ProposeOptions): Promise<void> {
  try {
    Logger.header("Proposing Changes to Template Repository");

    // Check if gh CLI is available
    if (!GitHelper.isGhCliAvailable()) {
      Logger.error("GitHub CLI (gh) is not installed or not available in PATH");
      Logger.newline();
      Logger.info("To create pull requests, please install gh CLI:");
      Logger.listItem("Visit: https://cli.github.com/");
      Logger.listItem("Or run: brew install gh (macOS)");
      Logger.listItem("Or run: sudo apt install gh (Ubuntu/Debian)");
      Logger.newline();
      Logger.info("After installation, authenticate with: gh auth login");
      process.exit(1);
    }

    const configLoader = new ConfigLoader();

    // Check if config exists
    if (!(await configLoader.exists())) {
      Logger.error(
        "No configuration found. Run 'agent-cookbook init' first."
      );
      process.exit(1);
    }

    const config = await configLoader.load();

    // Check if propose is enabled
    if (config.propose && !config.propose.enabled) {
      Logger.error("Propose feature is disabled in configuration");
      Logger.info('Enable it by setting "propose.enabled: true" in .agentcookbook.yaml');
      process.exit(1);
    }

    // Get propose config with defaults
    const proposeConfig = config.propose || {
      enabled: true,
      requireReview: true,
      branchPrefix: "proposed/",
      prLabels: ["template-update"],
      defaultReviewers: [],
    };

    // Sync template repository
    Logger.step("Syncing template repository");
    const stopLoading = Logger.loading("Fetching latest templates...");

    const templateManager = new TemplateManager();
    try {
      await templateManager.syncRepository(
        config.repository.url,
        config.repository.branch
      );
      stopLoading();
      Logger.success("Template repository synced");
    } catch (error: any) {
      stopLoading();
      Logger.error(`Failed to sync repository: ${error.message}`);
      process.exit(1);
    }

    // Filter mappings if specific templates requested
    let mappingsToPropose = config.mappings;
    if (options.templates && options.templates.length > 0) {
      mappingsToPropose = config.mappings.filter((m) =>
        options.templates!.includes(m.name)
      );
      if (mappingsToPropose.length === 0) {
        Logger.error(
          `No mappings found matching: ${options.templates.join(", ")}`
        );
        process.exit(1);
      }
    }

    // Analyze changes
    Logger.step("Analyzing changes");

    const pathResolver = new PathResolver(config.variables);
    const merger = new TemplateMerger(config.merge.delimiter);
    const repoPath = templateManager.getRepoPath(config.repository.url);
    const gitHelper = new GitHelper(repoPath);

    interface ChangeInfo {
      mapping: any;
      localPath: string;
      templatePath: string;
      localTemplateSection: string;
      upstreamTemplateSection: string;
      hasChanges: boolean;
    }

    const changes: ChangeInfo[] = [];
    let modifiedCount = 0;
    let noChangeCount = 0;
    let skippedCount = 0;

    for (const mapping of mappingsToPropose) {
      try {
        // Resolve local target path
        const resolved = pathResolver.resolvePath(mapping.targetPath);

        // Check if local file exists
        if (!(await fs.pathExists(resolved.resolved))) {
          Logger.info(
            `Skipped ${mapping.name}: Local file not found`
          );
          skippedCount++;
          continue;
        }

        // Read local file
        const localContent = await fs.readFile(resolved.resolved, "utf-8");
        const localTemplateSection = merger.getTemplateSection(localContent);

        // Read upstream template
        const upstreamContent = await templateManager.readTemplate(
          config.repository.url,
          mapping.template
        );
        const upstreamTemplateSection = merger.getTemplateSection(upstreamContent);

        // Compare
        const hasChanges = merger.hasChanges(
          localTemplateSection,
          upstreamTemplateSection
        );

        if (hasChanges) {
          Logger.success(`${mapping.name}: Template section modified`);
          modifiedCount++;
        } else {
          Logger.info(`${mapping.name}: No changes detected`);
          noChangeCount++;
        }

        changes.push({
          mapping,
          localPath: resolved.resolved,
          templatePath: mapping.template,
          localTemplateSection,
          upstreamTemplateSection,
          hasChanges,
        });
      } catch (error: any) {
        Logger.error(`Failed to analyze ${mapping.name}: ${error.message}`);
        skippedCount++;
      }
    }

    // Filter to only changes
    const modifiedChanges = changes.filter((c) => c.hasChanges);

    if (modifiedChanges.length === 0) {
      Logger.newline();
      Logger.info("No template changes to propose");
      Logger.info(
        `Analyzed: ${changes.length} files, No changes: ${noChangeCount}, Skipped: ${skippedCount}`
      );
      return;
    }

    if (options.dryRun) {
      Logger.newline();
      Logger.header("Dry Run Summary");
      Logger.info(`Would propose ${Logger.formatCount(modifiedChanges.length)} template updates:`);
      modifiedChanges.forEach((change) => {
        Logger.listItem(`${change.mapping.name} (${change.templatePath})`, 1);
      });
      Logger.newline();
      Logger.info("Run without --dry-run to create the pull request");
      return;
    }

    // Create branch
    Logger.newline();
    Logger.step("Creating proposal branch");

    const timestamp = Date.now();
    const templateNames = modifiedChanges.map((c) => c.mapping.name).join("-");
    const sanitizedNames = templateNames
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .substring(0, 50);
    const branchName = `${proposeConfig.branchPrefix}update-${sanitizedNames}-${timestamp}`;

    try {
      // Ensure we're on the main branch
      await gitHelper.checkout(config.repository.branch);

      // Pull latest changes
      await gitHelper.pull("origin", config.repository.branch);

      // Create new branch
      await gitHelper.createBranch(branchName);
      Logger.success(`Branch created: ${Logger.formatPath(branchName)}`);
    } catch (error: any) {
      Logger.error(`Failed to create branch: ${error.message}`);
      process.exit(1);
    }

    // Update template files
    Logger.step("Updating template files");

    const filesToCommit: string[] = [];
    for (const change of modifiedChanges) {
      try {
        const templateFullPath = path.join(repoPath, change.templatePath);

        // Ensure delimiter is present in the updated content
        const updatedContent = merger.ensureDelimiter(
          change.localTemplateSection
        );

        // Write updated template section
        await fs.writeFile(templateFullPath, updatedContent, "utf-8");

        filesToCommit.push(change.templatePath);
        Logger.success(`Updated ${Logger.formatPath(change.templatePath)}`);
      } catch (error: any) {
        Logger.error(
          `Failed to update ${change.templatePath}: ${error.message}`
        );
      }
    }

    if (filesToCommit.length === 0) {
      Logger.error("No files were updated successfully");
      process.exit(1);
    }

    // Commit changes
    Logger.step("Committing changes");

    const commitMessage =
      options.message ||
      `Update ${filesToCommit.length} template${filesToCommit.length > 1 ? "s" : ""}

Updated templates:
${filesToCommit.map((f) => `- ${f}`).join("\n")}`;

    try {
      await gitHelper.addFiles(filesToCommit);
      await gitHelper.commit(commitMessage);
      Logger.success("Changes committed");
    } catch (error: any) {
      Logger.error(`Failed to commit: ${error.message}`);
      process.exit(1);
    }

    // Push branch
    Logger.step("Pushing changes to template repository");

    try {
      await gitHelper.pushBranch(branchName);
      Logger.success("Changes pushed");
    } catch (error: any) {
      Logger.error(`Failed to push: ${error.message}`);
      process.exit(1);
    }

    // Create PR
    Logger.step("Creating pull request");

    const prTitle =
      options.title ||
      `Update ${modifiedChanges.length} template${modifiedChanges.length > 1 ? "s" : ""}`;

    const prBody =
      options.description ||
      `## Summary

This PR proposes updates to the following templates:

${modifiedChanges.map((c) => `- **${c.mapping.name}** (\`${c.templatePath}\`)`).join("\n")}

## Changes

${modifiedChanges
  .map((c) => {
    return `### ${c.mapping.name}

Template section has been updated with improvements from a project using this template.`;
  })
  .join("\n\n")}

## Review Notes

Please review the proposed changes to ensure they maintain template quality and don't include project-specific details.

---
*Generated by Agent Cookbook CLI*`;

    try {
      const prUrl = GitHelper.createPullRequest(
        prTitle,
        prBody,
        config.repository.branch,
        proposeConfig.prLabels,
        proposeConfig.defaultReviewers
      );

      Logger.success("Pull request created");
      Logger.newline();
      Logger.header("Proposal Summary");
      Logger.info(`PR URL: ${Logger.formatPath(prUrl)}`);
      Logger.info(`Title: ${prTitle}`);
      Logger.info(`Branch: ${branchName}`);
      Logger.info(
        `Templates: ${Logger.formatCount(modifiedChanges.length)}`
      );

      if (proposeConfig.prLabels.length > 0) {
        Logger.info(`Labels: ${proposeConfig.prLabels.join(", ")}`);
      }

      if (proposeConfig.defaultReviewers.length > 0) {
        Logger.info(
          `Reviewers: ${proposeConfig.defaultReviewers.join(", ")}`
        );
      }

      Logger.newline();
      Logger.success("Your proposal is ready for review!");
    } catch (error: any) {
      Logger.error(`Failed to create PR: ${error.message}`);
      Logger.newline();
      Logger.info("Branch has been pushed but PR creation failed");
      Logger.info(`Branch: ${branchName}`);
      Logger.info("You can create the PR manually on GitHub");
      process.exit(1);
    }
  } catch (error: any) {
    Logger.error(`Propose failed: ${error.message}`);
    if (error.stack) {
      Logger.log(error.stack);
    }
    process.exit(1);
  }
}
