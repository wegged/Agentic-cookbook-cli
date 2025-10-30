/**
 * Core type definitions for Agent Cookbook CLI
 */

export interface PathVariables {
  [key: string]: string;
}

export interface ResolvedPath {
  original: string;
  resolved: string;
  variables: string[];
}

export interface TemplateMapping {
  name: string;
  template: string;
  targetPath: string;
  conditions?: MappingCondition[];
}

export interface MappingCondition {
  fileExists?: string;
}

export interface RepositoryConfig {
  url: string;
  branch: string;
}

export interface MergeConfig {
  delimiter: string;
  strategy: "preserve-project" | "three-way";
  conflictResolution: "manual" | "auto-template" | "auto-project";
}

export interface ValidationConfig {
  requireDelimiter: boolean;
  maxFileSize: string;
  allowedSections: string[];
}

export interface AgentCookbookConfig {
  repository: RepositoryConfig;
  variables: PathVariables;
  mappings: TemplateMapping[];
  merge: MergeConfig;
  validation: ValidationConfig;
}

export interface TemplateMetadataEntry {
  path: string;
  description: string;
  requiredVariables: string[];
}

export interface TemplateMetadata {
  version: string;
  templates: TemplateMetadataEntry[];
}

export interface MergeResult {
  content: string;
  hasConflict: boolean;
  conflictDetails?: ConflictDetails;
}

export interface ConflictDetails {
  templateSection: string;
  projectSection: string;
  reason: string;
}

export interface TemplateCache {
  path: string;
  lastUpdated: Date;
  version: string;
}

export interface InitOptions {
  repo?: string;
  config?: string;
  force?: boolean;
  interactive?: boolean;
  dryRun?: boolean;
}

export interface UpdateOptions {
  strategy?: string;
  force?: boolean;
  dryRun?: boolean;
  conflict?: string;
}

export interface SyncOptions {
  checkOnly?: boolean;
  force?: boolean;
}

export interface ValidateOptions {
  fix?: boolean;
  strict?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  file: string;
  message: string;
  line?: number;
}

export interface ValidationWarning {
  file: string;
  message: string;
  line?: number;
}
