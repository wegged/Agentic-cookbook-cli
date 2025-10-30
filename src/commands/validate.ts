import * as fs from "fs-extra";
import { ValidateOptions, ValidationResult, ValidationError, ValidationWarning } from "../types";
import { ConfigLoader } from "../core/config-loader";
import { PathResolver } from "../core/path-resolver";
import { TemplateMerger } from "../core/merger";
import { Logger } from "../utils/logger";

/**
 * Validate command - Ensure all AGENTS.md files follow expected structure
 */
export async function validateCommand(options: ValidateOptions): Promise<void> {
  try {
    Logger.header("Validating AGENTS.md Files");

    const configLoader = new ConfigLoader();

    // Check if config exists
    if (!(await configLoader.exists())) {
      Logger.error(
        "No configuration found. Run 'agent-cookbook init' first."
      );
      process.exit(1);
    }

    const config = await configLoader.load();

    // Validate configuration first
    const configErrors = configLoader.validate(config);
    if (configErrors.length > 0) {
      Logger.error("Configuration validation failed:");
      configErrors.forEach((err) => Logger.listItem(err, 1));
      process.exit(1);
    }

    const pathResolver = new PathResolver(config.variables);
    const merger = new TemplateMerger(config.merge.delimiter);

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let validCount = 0;

    for (const mapping of config.mappings) {
      try {
        // Skip folder-type mappings (they contain multiple files)
        if (mapping.type === "folder") {
          continue;
        }

        // Resolve target path
        const resolved = pathResolver.resolvePath(mapping.targetPath);

        // Check if file exists
        if (!(await fs.pathExists(resolved.resolved))) {
          warnings.push({
            file: resolved.resolved,
            message: "File does not exist",
          });
          continue;
        }

        // Read file
        const content = await fs.readFile(resolved.resolved, "utf-8");

        // Check delimiter presence
        if (config.validation.requireDelimiter && !merger.hasDelimiter(content)) {
          errors.push({
            file: resolved.resolved,
            message: `Missing delimiter: ${merger.getDelimiter()}`,
          });
        }

        // Check file size
        const stats = await fs.stat(resolved.resolved);
        const maxSize = parseFileSize(config.validation.maxFileSize);
        if (stats.size > maxSize) {
          warnings.push({
            file: resolved.resolved,
            message: `File size (${formatBytes(stats.size)}) exceeds maximum (${
              config.validation.maxFileSize
            })`,
          });
        }

        // Check for required sections
        for (const section of config.validation.allowedSections) {
          const sectionHeader = `## ${section}`;
          if (!content.includes(sectionHeader)) {
            warnings.push({
              file: resolved.resolved,
              message: `Missing recommended section: ${section}`,
            });
          }
        }

        // Check markdown structure
        if (!content.trim().startsWith("#")) {
          warnings.push({
            file: resolved.resolved,
            message: "File should start with a markdown header",
          });
        }

        if (errors.filter((e) => e.file === resolved.resolved).length === 0) {
          validCount++;
        }
      } catch (error: any) {
        errors.push({
          file: mapping.targetPath,
          message: `Validation error: ${error.message}`,
        });
      }
    }

    // Display results
    Logger.newline();

    if (errors.length > 0) {
      Logger.error(`Found ${Logger.formatCount(errors.length)} errors:`);
      errors.forEach((err) => {
        Logger.listItem(
          `${Logger.formatPath(err.file)}: ${err.message}`,
          1
        );
      });
      Logger.newline();
    }

    if (warnings.length > 0) {
      Logger.warning(`Found ${Logger.formatCount(warnings.length)} warnings:`);
      warnings.forEach((warn) => {
        Logger.listItem(
          `${Logger.formatPath(warn.file)}: ${warn.message}`,
          1
        );
      });
      Logger.newline();
    }

    // Summary
    if (errors.length === 0 && warnings.length === 0) {
      Logger.success("All AGENTS.md files are valid");
      Logger.success(
        `Validated ${Logger.formatCount(validCount)} files successfully`
      );
    } else {
      if (errors.length === 0) {
        Logger.info(
          `${Logger.formatCount(validCount)} files passed validation`
        );
      }

      if (options.strict && warnings.length > 0) {
        Logger.error("Validation failed (strict mode enabled)");
        process.exit(1);
      }

      if (errors.length > 0) {
        Logger.error("Validation failed");
        process.exit(1);
      }
    }

    // Auto-fix if requested
    if (options.fix && errors.length > 0) {
      Logger.newline();
      Logger.step("Attempting to auto-fix issues");

      let fixedCount = 0;
      for (const error of errors) {
        if (error.message.includes("Missing delimiter")) {
          try {
            const content = await fs.readFile(error.file, "utf-8");
            const fixed = merger.ensureDelimiter(content);
            await fs.writeFile(error.file, fixed, "utf-8");
            Logger.success(`Fixed: ${Logger.formatPath(error.file)}`);
            fixedCount++;
          } catch (err: any) {
            Logger.error(`Failed to fix ${error.file}: ${err.message}`);
          }
        }
      }

      Logger.newline();
      Logger.success(
        `Fixed ${Logger.formatCount(fixedCount)} of ${Logger.formatCount(
          errors.length
        )} errors`
      );
    }
  } catch (error: any) {
    Logger.error(`Validation failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Parse file size string to bytes
 */
function parseFileSize(sizeStr: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(\w+)$/);
  if (!match) return 50 * 1024; // Default 50KB

  const value = parseFloat(match[1]);
  const unit = match[2];

  return value * (units[unit] || 1);
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
