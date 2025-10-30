#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init";
import { updateCommand } from "./commands/update";
import { syncCommand } from "./commands/sync";
import { validateCommand } from "./commands/validate";
import { configCommand } from "./commands/config";
import { recipeCommand } from "./commands/recipe";
import { proposeCommand } from "./commands/propose";

const program = new Command();

program
  .name("agent-cookbook")
  .description("Manage AGENTS.md files across your codebase")
  .version("1.0.0");

// Init command
program
  .command("init")
  .description("Initialize project with AGENTS.md templates")
  .option("-r, --repo <url>", "Template repository URL")
  .option("-c, --config <path>", "Path to config file")
  .option("-f, --force", "Overwrite existing files")
  .option("-i, --interactive", "Interactive setup", true)
  .option("--dry-run", "Show what would be created")
  .action(initCommand);

// Update command
program
  .command("update")
  .description("Update AGENTS.md files from template repository")
  .argument("[templates...]", "Specific templates to update")
  .option("-s, --strategy <type>", "Merge strategy", "preserve-project")
  .option("-f, --force", "Overwrite without merging")
  .option("-b, --branch <branch>", "Update only templates from specific branch")
  .option("--dry-run", "Show what would be updated")
  .option("--conflict <action>", "Conflict resolution", "manual")
  .action(updateCommand);

// Sync command
program
  .command("sync")
  .description("Sync specific template or check sync status")
  .argument("[template]", "Template name to sync")
  .option("--check-only", "Only check if in sync")
  .option("-f, --force", "Force sync")
  .action(syncCommand);

// Validate command
program
  .command("validate")
  .description("Validate AGENTS.md files structure")
  .option("--fix", "Auto-fix issues")
  .option("--strict", "Fail on warnings")
  .action(validateCommand);

// Config command
program
  .command("config")
  .description("Manage configuration")
  .argument("<action>", "Action to perform (get, set, list, set-variable, add-mapping, remove-mapping)")
  .argument("[args...]", "Action arguments")
  .action(configCommand);

// Recipe command
program
  .command("recipe")
  .description("Manage recipes from template repository")
  .argument("<action>", "Action to perform (list, show, add, update)")
  .argument("[args...]", "Action arguments")
  .option("--tag <tag>", "Filter recipes by tag")
  .option("--output <path>", "Output path for recipe add")
  .action(recipeCommand);

// Propose command
program
  .command("propose")
  .description("Propose template changes back to template repository")
  .option("-m, --message <message>", "Commit message for the proposal")
  .option("-d, --description <desc>", "PR description")
  .option("-t, --title <title>", "PR title")
  .option("--templates <names...>", "Specific templates to propose")
  .option("--branch <name>", "Custom branch name")
  .option("--dry-run", "Show what would be proposed")
  .action(proposeCommand);

// Parse arguments
program.parse();
