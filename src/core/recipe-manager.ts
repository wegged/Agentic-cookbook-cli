import * as path from "path";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import { Recipe, RecipeMetadata, RecipeMetadataEntry } from "../types";

/**
 * RecipeManager handles recipe operations from template repository
 *
 * Manages loading, caching, and filtering recipes
 */
export class RecipeManager {
  private repoPath: string;
  private localCachePath: string;

  constructor(repoPath: string, localCachePath: string = ".recipes") {
    this.repoPath = repoPath;
    this.localCachePath = localCachePath;
  }

  /**
   * Load recipe metadata from template repository
   *
   * @returns Recipe metadata
   * @throws Error if metadata file not found or invalid
   */
  async loadMetadata(): Promise<RecipeMetadata> {
    const metadataPath = path.join(this.repoPath, ".agentcookbook-recipes.yaml");

    if (!(await fs.pathExists(metadataPath))) {
      // Return empty metadata if file doesn't exist
      return { version: "1.0.0", recipes: [] };
    }

    const content = await fs.readFile(metadataPath, "utf-8");
    return yaml.load(content) as RecipeMetadata;
  }

  /**
   * Get all available recipes
   *
   * @returns Array of recipes
   */
  async listRecipes(): Promise<Recipe[]> {
    const metadata = await this.loadMetadata();

    return metadata.recipes.map((entry: RecipeMetadataEntry) => ({
      name: entry.name,
      path: entry.path,
      description: entry.description,
      tags: entry.tags || [],
      services: entry.services || [],
    }));
  }

  /**
   * Filter recipes by tag
   *
   * @param tag - Tag to filter by
   * @returns Array of recipes with the specified tag
   */
  async filterByTag(tag: string): Promise<Recipe[]> {
    const recipes = await this.listRecipes();
    return recipes.filter((recipe) => recipe.tags.includes(tag));
  }

  /**
   * Get a specific recipe by name
   *
   * @param name - Recipe name
   * @returns Recipe with content
   * @throws Error if recipe not found
   */
  async getRecipe(name: string): Promise<Recipe> {
    const recipes = await this.listRecipes();
    const recipe = recipes.find((r) => r.name === name);

    if (!recipe) {
      throw new Error(`Recipe not found: ${name}`);
    }

    // Load recipe content
    const recipePath = path.join(this.repoPath, recipe.path);

    if (!(await fs.pathExists(recipePath))) {
      throw new Error(`Recipe file not found: ${recipe.path}`);
    }

    const content = await fs.readFile(recipePath, "utf-8");

    return {
      ...recipe,
      content,
    };
  }

  /**
   * Cache recipes locally
   *
   * @throws Error if caching fails
   */
  async cacheRecipes(): Promise<void> {
    const metadata = await this.loadMetadata();

    // Create local cache directory
    await fs.ensureDir(this.localCachePath);

    // Copy metadata file
    const metadataPath = path.join(this.repoPath, ".agentcookbook-recipes.yaml");
    if (await fs.pathExists(metadataPath)) {
      await fs.copy(
        metadataPath,
        path.join(this.localCachePath, ".agentcookbook-recipes.yaml")
      );
    }

    // Copy each recipe file
    for (const recipe of metadata.recipes) {
      const sourcePath = path.join(this.repoPath, recipe.path);
      const targetPath = path.join(this.localCachePath, recipe.path);

      if (await fs.pathExists(sourcePath)) {
        await fs.ensureDir(path.dirname(targetPath));
        await fs.copy(sourcePath, targetPath);
      }
    }
  }

  /**
   * Copy a recipe to a local project path
   *
   * @param name - Recipe name
   * @param outputPath - Output directory path
   * @throws Error if recipe not found or copy fails
   */
  async addRecipe(name: string, outputPath: string): Promise<string> {
    const recipe = await this.getRecipe(name);

    // Create output directory if it doesn't exist
    await fs.ensureDir(outputPath);

    // Determine output file path
    const fileName = path.basename(recipe.path);
    const targetPath = path.join(outputPath, fileName);

    // Write recipe content to file
    if (recipe.content) {
      await fs.writeFile(targetPath, recipe.content, "utf-8");
    }

    return targetPath;
  }

  /**
   * Check if local cache exists
   *
   * @returns True if cache exists
   */
  async cacheExists(): Promise<boolean> {
    return await fs.pathExists(this.localCachePath);
  }

  /**
   * Get all unique tags from recipes
   *
   * @returns Array of unique tags
   */
  async getAllTags(): Promise<string[]> {
    const recipes = await this.listRecipes();
    const tags = new Set<string>();

    for (const recipe of recipes) {
      for (const tag of recipe.tags) {
        tags.add(tag);
      }
    }

    return Array.from(tags).sort();
  }
}
