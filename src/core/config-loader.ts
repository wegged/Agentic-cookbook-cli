import * as path from "path";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import { AgentCookbookConfig } from "../types";

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: AgentCookbookConfig = {
  repository: {
    url: "",
    branch: "main",
  },
  variables: {},
  mappings: [],
  merge: {
    delimiter: "<!-- PROJECT_SPECIFIC -->",
    strategy: "preserve-project",
    conflictResolution: "manual",
  },
  validation: {
    requireDelimiter: true,
    maxFileSize: "50kb",
    allowedSections: [
      "Overview",
      "Folder Purpose",
      "Agent Instructions",
      "Project Specific",
    ],
  },
  recipes: {
    enabled: true,
    localPath: ".recipes",
    includeInAgents: true,
  },
  propose: {
    enabled: true,
    requireReview: true,
    branchPrefix: "proposed/",
    prLabels: ["template-update", "community-contribution"],
    defaultReviewers: [],
  },
};

/**
 * ConfigLoader handles loading and saving Agent Cookbook configuration
 */
export class ConfigLoader {
  private configPath: string;

  constructor(configPath: string = ".agentcookbook.yaml") {
    this.configPath = configPath;
  }

  /**
   * Load configuration from file
   *
   * @returns Configuration object
   * @throws Error if config file doesn't exist or is invalid
   */
  async load(): Promise<AgentCookbookConfig> {
    if (!(await this.exists())) {
      throw new Error(
        `Configuration file not found: ${this.configPath}\nRun 'agent-cookbook init' to create one.`
      );
    }

    const content = await fs.readFile(this.configPath, "utf-8");
    const config = yaml.load(content) as Partial<AgentCookbookConfig>;

    // Merge with defaults
    return {
      ...DEFAULT_CONFIG,
      ...config,
      repository: { ...DEFAULT_CONFIG.repository, ...config.repository },
      merge: { ...DEFAULT_CONFIG.merge, ...config.merge },
      validation: { ...DEFAULT_CONFIG.validation, ...config.validation },
      recipes: config.recipes ? { ...DEFAULT_CONFIG.recipes, ...config.recipes } : DEFAULT_CONFIG.recipes,
      propose: config.propose ? { ...DEFAULT_CONFIG.propose, ...config.propose } : DEFAULT_CONFIG.propose,
      variables: config.variables || {},
      mappings: config.mappings || [],
    };
  }

  /**
   * Save configuration to file
   *
   * @param config - Configuration to save
   */
  async save(config: AgentCookbookConfig): Promise<void> {
    const content = yaml.dump(config, {
      indent: 2,
      lineWidth: -1,
    });
    await fs.writeFile(this.configPath, content, "utf-8");
  }

  /**
   * Check if configuration file exists
   *
   * @returns True if config file exists
   */
  async exists(): Promise<boolean> {
    return await fs.pathExists(this.configPath);
  }

  /**
   * Create a new configuration file with defaults
   *
   * @param repoUrl - Template repository URL
   * @param variables - Initial path variables
   */
  async create(repoUrl: string, variables: { [key: string]: string }): Promise<void> {
    const config: AgentCookbookConfig = {
      ...DEFAULT_CONFIG,
      repository: {
        url: repoUrl,
        branch: "main",
      },
      variables,
    };

    await this.save(config);
  }

  /**
   * Update configuration values
   *
   * @param updates - Partial configuration to merge
   */
  async update(updates: Partial<AgentCookbookConfig>): Promise<void> {
    const config = await this.load();
    const updated = { ...config, ...updates };
    await this.save(updated);
  }

  /**
   * Set a path variable
   *
   * @param key - Variable name
   * @param value - Variable value
   */
  async setVariable(key: string, value: string): Promise<void> {
    const config = await this.load();
    config.variables[key] = value;
    await this.save(config);
  }

  /**
   * Get a configuration value
   *
   * @param key - Dot-notation key (e.g., "repository.url")
   * @returns Value at the specified key
   */
  async get(key: string): Promise<any> {
    const config = await this.load();
    const keys = key.split(".");
    let value: any = config;

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Get the configuration file path
   *
   * @returns Path to configuration file
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Validate configuration
   *
   * @param config - Configuration to validate
   * @returns Array of validation errors (empty if valid)
   */
  validate(config: AgentCookbookConfig): string[] {
    const errors: string[] = [];

    if (!config.repository.url) {
      errors.push("Repository URL is required");
    }

    if (!config.repository.branch) {
      errors.push("Repository branch is required");
    }

    if (!config.merge.delimiter) {
      errors.push("Merge delimiter is required");
    }

    for (const mapping of config.mappings) {
      if (!mapping.name) {
        errors.push("Mapping name is required");
      }
      if (!mapping.template) {
        errors.push(`Mapping "${mapping.name}" is missing template path`);
      }
      if (!mapping.targetPath) {
        errors.push(`Mapping "${mapping.name}" is missing target path`);
      }
    }

    return errors;
  }
}
