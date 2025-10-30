import * as yaml from "js-yaml";
import inquirer from "inquirer";
import { ConfigLoader } from "../core/config-loader";
import { Logger } from "../utils/logger";
import { TemplateMapping } from "../types";

/**
 * Config command - Manage configuration and variables
 */
export async function configCommand(action: string, args: string[]): Promise<void> {
  try {
    const configLoader = new ConfigLoader();

    // Check if config exists (except for init-like operations)
    if (action !== "init" && !(await configLoader.exists())) {
      Logger.error(
        "No configuration found. Run 'agent-cookbook init' first."
      );
      process.exit(1);
    }

    switch (action) {
      case "get":
        await handleGet(configLoader, args);
        break;

      case "set":
        await handleSet(configLoader, args);
        break;

      case "list":
        await handleList(configLoader);
        break;

      case "set-variable":
        await handleSetVariable(configLoader, args);
        break;

      case "add-mapping":
        await handleAddMapping(configLoader);
        break;

      case "remove-mapping":
        await handleRemoveMapping(configLoader, args);
        break;

      default:
        Logger.error(`Unknown action: ${action}`);
        Logger.info("Available actions: get, set, list, set-variable, add-mapping, remove-mapping");
        process.exit(1);
    }
  } catch (error: any) {
    Logger.error(`Config command failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Get a configuration value
 */
async function handleGet(configLoader: ConfigLoader, args: string[]): Promise<void> {
  if (args.length === 0) {
    Logger.error("Usage: agent-cookbook config get <key>");
    process.exit(1);
  }

  const key = args[0];
  const value = await configLoader.get(key);

  if (value === undefined) {
    Logger.error(`Key not found: ${key}`);
    process.exit(1);
  }

  if (typeof value === "object") {
    console.log(yaml.dump(value));
  } else {
    console.log(value);
  }
}

/**
 * Set a configuration value (not implemented - requires complex parsing)
 */
async function handleSet(configLoader: ConfigLoader, args: string[]): Promise<void> {
  Logger.error("Setting arbitrary config values is not yet implemented");
  Logger.info("Use 'set-variable' for variables or edit .agentcookbook.yaml directly");
  process.exit(1);
}

/**
 * List all configuration
 */
async function handleList(configLoader: ConfigLoader): Promise<void> {
  const config = await configLoader.load();

  Logger.header("Agent Cookbook Configuration");

  Logger.log("Repository:");
  Logger.listItem(`URL: ${config.repository.url}`, 1);
  Logger.listItem(`Branch: ${config.repository.branch}`, 1);
  Logger.newline();

  Logger.log("Variables:");
  if (Object.keys(config.variables).length === 0) {
    Logger.listItem("(none)", 1);
  } else {
    for (const [key, value] of Object.entries(config.variables)) {
      Logger.listItem(`${Logger.formatVariable(key)}: ${value}`, 1);
    }
  }
  Logger.newline();

  Logger.log("Mappings:");
  if (config.mappings.length === 0) {
    Logger.listItem("(none)", 1);
  } else {
    for (const mapping of config.mappings) {
      Logger.listItem(`${mapping.name}`, 1);
      Logger.listItem(`Template: ${mapping.template}`, 2);
      Logger.listItem(`Target: ${mapping.targetPath}`, 2);
    }
  }
  Logger.newline();

  Logger.log("Merge:");
  Logger.listItem(`Strategy: ${config.merge.strategy}`, 1);
  Logger.listItem(`Delimiter: ${config.merge.delimiter}`, 1);
  Logger.listItem(`Conflict Resolution: ${config.merge.conflictResolution}`, 1);
  Logger.newline();

  Logger.log("Validation:");
  Logger.listItem(`Require Delimiter: ${config.validation.requireDelimiter}`, 1);
  Logger.listItem(`Max File Size: ${config.validation.maxFileSize}`, 1);
}

/**
 * Set a path variable
 */
async function handleSetVariable(
  configLoader: ConfigLoader,
  args: string[]
): Promise<void> {
  if (args.length < 2) {
    Logger.error("Usage: agent-cookbook config set-variable <key> <value>");
    process.exit(1);
  }

  const key = args[0];
  const value = args[1];

  await configLoader.setVariable(key, value);
  Logger.success(`Set ${Logger.formatVariable(key)} = ${value}`);
}

/**
 * Add a new template mapping (interactive)
 */
async function handleAddMapping(configLoader: ConfigLoader): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Mapping name:",
      validate: (input: string) => (input ? true : "Name is required"),
    },
    {
      type: "input",
      name: "template",
      message: "Template path (in repository):",
      validate: (input: string) => (input ? true : "Template path is required"),
    },
    {
      type: "input",
      name: "targetPath",
      message: "Target path (in project, can use {{variables}}):",
      validate: (input: string) => (input ? true : "Target path is required"),
    },
  ]);

  const config = await configLoader.load();
  const newMapping: TemplateMapping = {
    name: answers.name,
    template: answers.template,
    targetPath: answers.targetPath,
  };

  config.mappings.push(newMapping);
  await configLoader.save(config);

  Logger.success(`Added mapping: ${answers.name}`);
}

/**
 * Remove a template mapping
 */
async function handleRemoveMapping(
  configLoader: ConfigLoader,
  args: string[]
): Promise<void> {
  if (args.length === 0) {
    Logger.error("Usage: agent-cookbook config remove-mapping <name>");
    process.exit(1);
  }

  const name = args[0];
  const config = await configLoader.load();

  const index = config.mappings.findIndex((m) => m.name === name);
  if (index === -1) {
    Logger.error(`Mapping not found: ${name}`);
    process.exit(1);
  }

  config.mappings.splice(index, 1);
  await configLoader.save(config);

  Logger.success(`Removed mapping: ${name}`);
}
