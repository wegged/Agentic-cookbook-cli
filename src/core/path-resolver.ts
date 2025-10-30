import { PathVariables, ResolvedPath } from "../types";

/**
 * PathResolver handles resolution of template variables in file paths
 *
 * Examples:
 *   "src/api/{{appName}}/AGENTS.md" -> "src/api/my-app/AGENTS.md"
 *   "src/{{namespace}}/{{apiVersion}}" -> "src/com.company/v1"
 */
export class PathResolver {
  private variables: PathVariables;

  constructor(variables: PathVariables) {
    this.variables = variables;
  }

  /**
   * Resolve template variables in a path
   *
   * @param templatePath - Path containing {{variable}} placeholders
   * @returns Resolved path with metadata
   * @throws Error if required variable is missing
   */
  resolvePath(templatePath: string): ResolvedPath {
    const variables: string[] = [];
    const resolved = templatePath.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      variables.push(varName);
      if (!(varName in this.variables)) {
        throw new Error(`Missing variable: ${varName}`);
      }
      return this.variables[varName];
    });

    return {
      original: templatePath,
      resolved,
      variables,
    };
  }

  /**
   * Extract variable names from a template path
   *
   * @param templatePath - Path containing {{variable}} placeholders
   * @returns Array of variable names found in the path
   */
  extractVariables(templatePath: string): string[] {
    const matches = templatePath.matchAll(/\{\{(\w+)\}\}/g);
    return Array.from(matches).map((m) => m[1]);
  }

  /**
   * Validate that all required variables are defined
   *
   * @param requiredVars - Array of variable names that must be defined
   * @returns Array of missing variable names (empty if all are defined)
   */
  validateVariables(requiredVars: string[]): string[] {
    return requiredVars.filter((v) => !(v in this.variables));
  }

  /**
   * Update the variables used for path resolution
   *
   * @param newVariables - New variables to set (merged with existing)
   */
  updateVariables(newVariables: PathVariables): void {
    this.variables = { ...this.variables, ...newVariables };
  }

  /**
   * Get all currently defined variables
   *
   * @returns Copy of current variables
   */
  getVariables(): PathVariables {
    return { ...this.variables };
  }

  /**
   * Check if a path contains any template variables
   *
   * @param path - Path to check
   * @returns True if path contains template variables
   */
  hasVariables(path: string): boolean {
    return /\{\{\w+\}\}/.test(path);
  }
}
