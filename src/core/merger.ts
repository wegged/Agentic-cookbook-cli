import { MergeResult, ConflictDetails } from "../types";

interface SplitContent {
  template: string;
  project: string;
  hasDelimiter: boolean;
}

/**
 * TemplateMerger handles smart merging of template content with project-specific content
 *
 * The merger preserves project-specific sections (after delimiter) while updating
 * template content (before delimiter)
 */
export class TemplateMerger {
  private delimiter: string;

  constructor(delimiter: string = "<!-- PROJECT_SPECIFIC -->") {
    this.delimiter = delimiter;
  }

  /**
   * Split content into template and project-specific sections
   *
   * @param content - File content to split
   * @returns Object with template section, project section, and delimiter presence flag
   */
  private splitContent(content: string): SplitContent {
    const parts = content.split(this.delimiter);
    if (parts.length === 1) {
      return {
        template: parts[0].trim(),
        project: "",
        hasDelimiter: false,
      };
    }
    return {
      template: parts[0].trim(),
      project: parts.slice(1).join(this.delimiter).trim(),
      hasDelimiter: true,
    };
  }

  /**
   * Merge template with existing file, preserving project-specific content
   *
   * @param newTemplate - New template content from repository
   * @param existingFile - Current file content from project
   * @param strategy - Merge strategy to use
   * @returns Merge result with merged content and conflict status
   */
  merge(
    newTemplate: string,
    existingFile: string,
    strategy: "preserve-project" | "three-way" = "preserve-project"
  ): MergeResult {
    const existing = this.splitContent(existingFile);
    const template = this.splitContent(newTemplate);

    // If no delimiter in existing file, treat entire file as project-specific
    if (!existing.hasDelimiter) {
      return {
        content: `${template.template}\n\n${this.delimiter}\n\n${existing.template}`,
        hasConflict: false,
      };
    }

    // Preserve project-specific section
    const mergedContent = [
      template.template,
      "",
      this.delimiter,
      "",
      existing.project,
    ].join("\n");

    return {
      content: mergedContent,
      hasConflict: false,
    };
  }

  /**
   * Detect if there are meaningful changes between versions
   *
   * @param content1 - First content to compare
   * @param content2 - Second content to compare
   * @returns True if contents differ meaningfully
   */
  hasChanges(content1: string, content2: string): boolean {
    const normalized1 = content1.trim().replace(/\s+/g, " ");
    const normalized2 = content2.trim().replace(/\s+/g, " ");
    return normalized1 !== normalized2;
  }

  /**
   * Extract just the template section from content
   *
   * @param content - File content
   * @returns Template section only
   */
  getTemplateSection(content: string): string {
    return this.splitContent(content).template;
  }

  /**
   * Extract just the project-specific section from content
   *
   * @param content - File content
   * @returns Project-specific section only
   */
  getProjectSection(content: string): string {
    return this.splitContent(content).project;
  }

  /**
   * Check if content has the delimiter
   *
   * @param content - File content to check
   * @returns True if delimiter is present
   */
  hasDelimiter(content: string): boolean {
    return content.includes(this.delimiter);
  }

  /**
   * Add delimiter to content if not present
   *
   * @param content - Content to add delimiter to
   * @returns Content with delimiter added at the end
   */
  ensureDelimiter(content: string): string {
    if (this.hasDelimiter(content)) {
      return content;
    }
    return `${content.trim()}\n\n${this.delimiter}\n\n`;
  }

  /**
   * Get the delimiter being used
   *
   * @returns Current delimiter string
   */
  getDelimiter(): string {
    return this.delimiter;
  }
}
