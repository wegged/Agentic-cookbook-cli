import { ConfigLoader } from "../core/config-loader";
import { TemplateManager } from "../core/template-manager";
import { RecipeManager } from "../core/recipe-manager";
import { Logger } from "../utils/logger";
import { RecipeListOptions, RecipeAddOptions } from "../types";
import chalk from "chalk";

/**
 * Recipe command - Manage recipes from template repository
 */
export async function recipeCommand(
  action: string,
  args: string[],
  options: RecipeListOptions & RecipeAddOptions
): Promise<void> {
  try {
    const configLoader = new ConfigLoader();

    // Check if config exists
    if (!(await configLoader.exists())) {
      Logger.error(
        "No configuration found. Run 'agent-cookbook init' first."
      );
      process.exit(1);
    }

    const config = await configLoader.load();

    // Check if recipes are enabled
    if (config.recipes && !config.recipes.enabled) {
      Logger.error("Recipes are disabled in configuration.");
      Logger.info("Set 'recipes.enabled: true' in .agentcookbook.yaml");
      process.exit(1);
    }

    const templateManager = new TemplateManager();
    const repoPath = templateManager.getRepoPath(config.repository.url, config.repository.branch);
    const localPath = config.recipes?.localPath || ".recipes";
    const recipeManager = new RecipeManager(repoPath, localPath);

    switch (action) {
      case "list":
        await handleList(recipeManager, options);
        break;

      case "show":
        await handleShow(recipeManager, args);
        break;

      case "add":
        await handleAdd(recipeManager, args, options);
        break;

      case "update":
        await handleUpdate(templateManager, recipeManager, config);
        break;

      default:
        Logger.error(`Unknown action: ${action}`);
        Logger.info("Available actions: list, show, add, update");
        process.exit(1);
    }
  } catch (error: any) {
    Logger.error(`Recipe command failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * List all available recipes
 */
async function handleList(
  recipeManager: RecipeManager,
  options: RecipeListOptions
): Promise<void> {
  let recipes;

  if (options.tag) {
    Logger.header(`Recipes tagged with "${options.tag}"`);
    recipes = await recipeManager.filterByTag(options.tag);
  } else {
    Logger.header("Available Recipes");
    recipes = await recipeManager.listRecipes();
  }

  if (recipes.length === 0) {
    if (options.tag) {
      Logger.warning(`No recipes found with tag "${options.tag}"`);
    } else {
      Logger.warning("No recipes available");
    }
    return;
  }

  for (const recipe of recipes) {
    Logger.log(chalk.bold.cyan(recipe.name));
    Logger.listItem(recipe.description, 1);

    if (recipe.tags.length > 0) {
      Logger.listItem(
        `Tags: ${recipe.tags.map((t) => chalk.yellow(t)).join(", ")}`,
        1
      );
    }

    if (recipe.services.length > 0) {
      Logger.listItem(
        `Services: ${recipe.services.join(", ")}`,
        1
      );
    }

    Logger.newline();
  }

  Logger.info(`Total: ${Logger.formatCount(recipes.length)} recipe(s)`);
  Logger.newline();

  // Show available tags
  const allTags = await recipeManager.getAllTags();
  if (allTags.length > 0) {
    Logger.log("Available tags:");
    Logger.listItem(allTags.map((t) => chalk.yellow(t)).join(", "), 1);
  }
}

/**
 * Show a specific recipe
 */
async function handleShow(
  recipeManager: RecipeManager,
  args: string[]
): Promise<void> {
  if (args.length === 0) {
    Logger.error("Usage: agent-cookbook recipe show <name>");
    process.exit(1);
  }

  const name = args[0];
  const recipe = await recipeManager.getRecipe(name);

  Logger.header(`Recipe: ${recipe.name}`);
  Logger.log(recipe.description);
  Logger.newline();

  if (recipe.tags.length > 0) {
    Logger.log(
      `Tags: ${recipe.tags.map((t) => chalk.yellow(t)).join(", ")}`
    );
  }

  if (recipe.services.length > 0) {
    Logger.log(`Services: ${recipe.services.join(", ")}`);
  }

  Logger.newline();
  Logger.log(chalk.dim("─".repeat(80)));
  Logger.newline();

  if (recipe.content) {
    Logger.log(recipe.content);
  } else {
    Logger.warning("Recipe content not available");
  }
}

/**
 * Add a recipe to local project
 */
async function handleAdd(
  recipeManager: RecipeManager,
  args: string[],
  options: RecipeAddOptions
): Promise<void> {
  if (args.length === 0) {
    Logger.error("Usage: agent-cookbook recipe add <name> [--output <path>]");
    process.exit(1);
  }

  const name = args[0];
  const outputPath = options.output || "docs/recipes";

  Logger.step(`Adding recipe "${name}" to ${outputPath}...`);

  const targetPath = await recipeManager.addRecipe(name, outputPath);

  Logger.success(`Recipe added: ${Logger.formatPath(targetPath)}`);
}

/**
 * Update recipes from template repository
 */
async function handleUpdate(
  templateManager: TemplateManager,
  recipeManager: RecipeManager,
  config: any
): Promise<void> {
  Logger.header("Updating Recipes");

  Logger.step("Syncing template repository...");
  await templateManager.syncRepository(
    config.repository.url,
    config.repository.branch
  );
  Logger.success("Template repository synced");

  Logger.step("Caching recipes locally...");
  await recipeManager.cacheRecipes();
  Logger.success(`Recipes cached to ${config.recipes?.localPath || ".recipes"}`);

  Logger.newline();
  Logger.info("Recipes updated successfully");

  // Show summary
  const recipes = await recipeManager.listRecipes();
  Logger.info(`Total recipes available: ${Logger.formatCount(recipes.length)}`);
}
