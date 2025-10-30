# Agent Cookbook CLI - Detailed Implementation Plan

## Overview

A CLI tool that manages AGENTS.md files across a codebase by downloading templates from a repository and intelligently merging updates while preserving project-specific customizations. The tool supports templatable paths to handle application names, namespaces, and other dynamic path components.

## Core Features

1. **Template Path Variables** - Support for dynamic path resolution
2. **Initialize Project** - Seed project with AGENTS.md files
3. **Update from Repository** - Pull latest template changes
4. **Smart Merging** - Preserve project-specific content during updates
5. **Validation** - Ensure AGENTS.md files follow expected structure
6. **Recipes** - Reusable instructions for common tasks using internal services
7. **Propose Changes** - Push local changes back to template repo and create PRs
8. **Nested Folder Support** - Copy entire folder structures, not just single files
9. **Branch-aware Mappings** - Map templates to specific branches in git repo

## Technical Stack

- **Language**: TypeScript
- **CLI Framework**: Commander.js
- **Prompts**: Inquirer.js
- **Styling**: Chalk
- **File Operations**: fs-extra
- **Pattern Matching**: fast-glob
- **Git Operations**: simple-git
- **YAML Parsing**: js-yaml
- **Merging**: diff3 or custom merge logic

## Project Structure

```
agent-cookbook-cli/
├── src/
│   ├── commands/
│   │   ├── init.ts           # Initialize project with templates
│   │   ├── update.ts         # Pull and merge updates
│   │   ├── sync.ts           # Sync specific templates
│   │   ├── validate.ts       # Validate AGENTS.md files
│   │   ├── config.ts         # Manage configuration
│   │   ├── recipe.ts         # Manage and run recipes
│   │   └── propose.ts        # Propose changes back to template repo
│   ├── core/
│   │   ├── template-manager.ts   # Template repository operations
│   │   ├── path-resolver.ts      # Handle templatable paths
│   │   ├── merger.ts             # Smart merge logic
│   │   ├── config-loader.ts      # Load and validate config
│   │   ├── recipe-manager.ts     # Recipe operations
│   │   └── file-copier.ts        # Recursive file/folder operations
│   ├── utils/
│   │   ├── logger.ts         # Colored console output
│   │   ├── git-helper.ts     # Git operations wrapper
│   │   └── validator.ts      # Schema validation
│   ├── types/
│   │   └── index.ts          # TypeScript definitions
│   └── index.ts              # CLI entry point
├── templates/                # Local cache of templates (gitignored)
├── .recipes/                 # Local recipes cache (gitignored)
├── tests/
├── package.json
├── tsconfig.json
└── README.md
```

## Configuration System

### Project Configuration File: `.agentcookbook.yaml`

Located in the project root:

```yaml
# Template repository configuration
repository:
  url: "git@github.com:yourteam/agent-templates.git"
  branch: "main"

# Path template variables
variables:
  appName: "my-awesome-app"
  namespace: "com.company"
  apiVersion: "v1"

# Template mappings with templatable paths
mappings:
  - name: "Backend API"
    template: "backend/api/AGENTS.md"
    targetPath: "src/api/{{appName}}/AGENTS.md"
    branch: "main"  # Optional: specific branch for this template

  - name: "Frontend Components"
    template: "frontend/components/AGENTS.md"
    targetPath: "src/frontend/{{appName}}/components/AGENTS.md"

  - name: "Database Migrations"
    template: "backend/database/AGENTS.md"
    targetPath: "src/database/{{namespace}}/migrations/AGENTS.md"

  - name: "Tests"
    template: "testing/AGENTS.md"
    targetPath: "tests/{{appName}}/AGENTS.md"
    conditions:
      - fileExists: "tests/{{appName}}"

  - name: "API Versioned"
    template: "backend/versioned-api/AGENTS.md"
    targetPath: "src/api/{{apiVersion}}/{{appName}}/AGENTS.md"

  # Nested folder mapping - copies entire folder structure
  - name: "Angular Project"
    template: "frontend/angular/"  # Trailing slash = folder
    targetPath: "src/{{appName}}/"
    type: "folder"  # Copy entire folder recursively

# Merge configuration
merge:
  delimiter: "<!-- PROJECT_SPECIFIC -->"
  strategy: "preserve-project" # or "three-way"
  conflictResolution: "manual" # or "auto-template", "auto-project"

# Validation rules
validation:
  requireDelimiter: true
  maxFileSize: "50kb"
  allowedSections:
    - "Overview"
    - "Folder Purpose"
    - "Agent Instructions"
    - "Project Specific"
```

### Template Repository Structure

```
agent-templates/
├── .agentcookbook-templates.yaml  # Template metadata
├── backend/
│   ├── api/
│   │   └── AGENTS.md
│   ├── database/
│   │   └── AGENTS.md
│   └── versioned-api/
│       └── AGENTS.md
├── frontend/
│   └── components/
│       └── AGENTS.md
├── testing/
│   └── AGENTS.md
└── README.md
```

### Template Metadata: `.agentcookbook-templates.yaml`

```yaml
version: "1.0.0"
templates:
  - path: "backend/api/AGENTS.md"
    description: "API endpoint development guidelines"
    requiredVariables: ["appName"]

  - path: "frontend/components/AGENTS.md"
    description: "Frontend component development"
    requiredVariables: ["appName"]

  - path: "backend/database/AGENTS.md"
    description: "Database migration guidelines"
    requiredVariables: ["namespace"]
```

## AGENTS.md File Structure

Each AGENTS.md file follows this structure:

```markdown
# Agent Instructions for [Folder Name]

## Overview
Brief description of this folder's purpose.

## Folder Purpose
What code lives here and why.

## Agent Instructions

### Code Style
- Style guidelines
- Naming conventions

### Testing Requirements
- What tests are needed
- Testing patterns

### Dependencies
- Common dependencies
- Import patterns

### Common Patterns
- Architectural patterns used here
- Best practices

<!-- PROJECT_SPECIFIC -->

## Project-Specific Notes

[This section is preserved during updates]

### Custom Requirements
- Project-specific rules
- Team conventions

### Local Context
- Database connection info
- API endpoints specific to this project
```

## Path Resolution System

### PathResolver Class (`src/core/path-resolver.ts`)

```typescript
interface PathVariables {
  [key: string]: string;
}

interface ResolvedPath {
  original: string;
  resolved: string;
  variables: string[];
}

class PathResolver {
  private variables: PathVariables;

  constructor(variables: PathVariables) {
    this.variables = variables;
  }

  /**
   * Resolve template variables in a path
   * Examples:
   *   "src/api/{{appName}}/AGENTS.md" -> "src/api/my-app/AGENTS.md"
   *   "src/{{namespace}}/{{apiVersion}}" -> "src/com.company/v1"
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
      variables
    };
  }

  /**
   * Extract variables from a template path
   */
  extractVariables(templatePath: string): string[] {
    const matches = templatePath.matchAll(/\{\{(\w+)\}\}/g);
    return Array.from(matches).map(m => m[1]);
  }

  /**
   * Validate that all required variables are defined
   */
  validateVariables(requiredVars: string[]): string[] {
    return requiredVars.filter(v => !(v in this.variables));
  }
}
```

## Command Implementations

### 1. Initialize Command (`agent-cookbook init`)

**Purpose**: Set up the project with initial AGENTS.md files

**Flow**:
1. Check if `.agentcookbook.yaml` exists
   - If not, run interactive setup
   - Prompt for repository URL
   - Prompt for common path variables (appName, namespace, etc.)
2. Clone/pull template repository to local cache
3. Load template metadata
4. Resolve all target paths using variables
5. For each mapping:
   - Check if target directory exists
   - Create directory if needed
   - Copy template to resolved path
   - Add project-specific delimiter if not present
6. Create `.agentcookbook.yaml` with configuration
7. Display summary of created files

**CLI Signature**:
```bash
agent-cookbook init [options]

Options:
  -r, --repo <url>          Template repository URL
  -c, --config <path>       Path to config file
  -f, --force               Overwrite existing files
  -i, --interactive         Interactive setup
  --dry-run                 Show what would be created
```

**Example Output**:
```
🚀 Initializing Agent Cookbook...

? Enter template repository URL: git@github.com:team/templates.git
? Enter app name: payment-service
? Enter namespace: com.company.payments

📦 Cloning template repository...
✓ Templates downloaded

📝 Creating AGENTS.md files...
✓ src/api/payment-service/AGENTS.md
✓ src/frontend/payment-service/components/AGENTS.md
✓ src/database/com.company.payments/migrations/AGENTS.md
✓ tests/payment-service/AGENTS.md

✨ Created 4 AGENTS.md files
📄 Configuration saved to .agentcookbook.yaml
```

### 2. Update Command (`agent-cookbook update`)

**Purpose**: Pull latest templates and merge with project-specific content

**Flow**:
1. Load `.agentcookbook.yaml`
2. Pull latest changes from template repository
3. For each mapping:
   - Resolve target path
   - Check if file exists locally
   - If exists:
     - Load current file
     - Extract project-specific section (after delimiter)
     - Load new template
     - Merge: template content + delimiter + project-specific content
     - Detect conflicts (if both sections changed)
     - Write merged content or mark for manual review
   - If not exists:
     - Create new file (like init)
4. Display summary of updates and conflicts

**Merge Strategies**:

- **preserve-project** (default): Always keep project-specific section unchanged
- **three-way**: Attempt three-way merge if template changed significantly
- **interactive**: Prompt user for each conflict

**CLI Signature**:
```bash
agent-cookbook update [options] [templates...]

Arguments:
  templates                 Specific template names to update (optional)

Options:
  -s, --strategy <type>     Merge strategy (preserve-project|three-way|interactive)
  -f, --force               Overwrite without merging
  --dry-run                 Show what would be updated
  --conflict <action>       How to handle conflicts (manual|auto-template|auto-project)
```

**Example Output**:
```
🔄 Updating Agent Cookbook templates...

📦 Fetching latest templates...
✓ Template repository updated (3 changes)

📝 Updating AGENTS.md files...
✓ src/api/payment-service/AGENTS.md (updated)
✓ src/frontend/payment-service/components/AGENTS.md (no changes)
⚠ src/database/com.company.payments/migrations/AGENTS.md (conflict detected)

⚠️  1 conflict requires manual review:
   - src/database/com.company.payments/migrations/AGENTS.md

Run 'agent-cookbook resolve' to handle conflicts
```

### 3. Sync Command (`agent-cookbook sync`)

**Purpose**: Sync a specific template or validate all files are up to date

**CLI Signature**:
```bash
agent-cookbook sync [template-name] [options]

Options:
  --check-only              Only check if files are in sync
  -f, --force               Force sync even if up to date
```

### 4. Validate Command (`agent-cookbook validate`)

**Purpose**: Ensure all AGENTS.md files follow the expected structure

**Checks**:
- Delimiter is present
- Required sections exist
- File size is reasonable
- Proper markdown structure
- All path variables are defined

**CLI Signature**:
```bash
agent-cookbook validate [options]

Options:
  --fix                     Auto-fix issues where possible
  --strict                  Fail on warnings
```

### 5. Config Command (`agent-cookbook config`)

**Purpose**: Manage configuration and variables

**CLI Signature**:
```bash
agent-cookbook config <action> [options]

Actions:
  set <key> <value>         Set a configuration value
  get <key>                 Get a configuration value
  list                      List all configuration
  add-mapping               Add a new template mapping (interactive)
  remove-mapping <name>     Remove a template mapping
  set-variable <key> <val>  Set a path variable
```

## Core Implementation Details

### Merger Implementation (`src/core/merger.ts`)

```typescript
interface MergeResult {
  content: string;
  hasConflict: boolean;
  conflictDetails?: ConflictDetails;
}

interface ConflictDetails {
  templateSection: string;
  projectSection: string;
  reason: string;
}

class TemplateMerger {
  private delimiter: string;

  constructor(delimiter: string = "<!-- PROJECT_SPECIFIC -->") {
    this.delimiter = delimiter;
  }

  /**
   * Split content into template and project-specific sections
   */
  private splitContent(content: string): {
    template: string;
    project: string;
    hasDelimiter: boolean;
  } {
    const parts = content.split(this.delimiter);
    if (parts.length === 1) {
      return {
        template: parts[0].trim(),
        project: "",
        hasDelimiter: false
      };
    }
    return {
      template: parts[0].trim(),
      project: parts.slice(1).join(this.delimiter).trim(),
      hasDelimiter: true
    };
  }

  /**
   * Merge template with existing file, preserving project-specific content
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
        hasConflict: false
      };
    }

    // Preserve project-specific section
    const mergedContent = [
      template.template,
      "",
      this.delimiter,
      "",
      existing.project
    ].join("\n");

    return {
      content: mergedContent,
      hasConflict: false
    };
  }

  /**
   * Detect if there are meaningful changes between versions
   */
  hasChanges(content1: string, content2: string): boolean {
    const normalized1 = content1.trim().replace(/\s+/g, " ");
    const normalized2 = content2.trim().replace(/\s+/g, " ");
    return normalized1 !== normalized2;
  }
}
```

### Template Manager Implementation (`src/core/template-manager.ts`)

```typescript
interface TemplateCache {
  path: string;
  lastUpdated: Date;
  version: string;
}

class TemplateManager {
  private cacheDir: string;
  private git: SimpleGit;

  constructor(cacheDir: string = ".agent-cookbook-cache") {
    this.cacheDir = path.join(os.homedir(), cacheDir);
    this.git = simpleGit();
  }

  /**
   * Clone or update the template repository
   */
  async syncRepository(repoUrl: string, branch: string = "main"): Promise<void> {
    const repoPath = this.getRepoPath(repoUrl);

    if (await this.repoExists(repoPath)) {
      // Update existing repo
      await this.git.cwd(repoPath);
      await this.git.fetch();
      await this.git.checkout(branch);
      await this.git.pull("origin", branch);
    } else {
      // Clone new repo
      await fs.ensureDir(this.cacheDir);
      await this.git.clone(repoUrl, repoPath, ["--branch", branch]);
    }
  }

  /**
   * Read a template file from the cache
   */
  async readTemplate(repoUrl: string, templatePath: string): Promise<string> {
    const repoPath = this.getRepoPath(repoUrl);
    const fullPath = path.join(repoPath, templatePath);

    if (!await fs.pathExists(fullPath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    return await fs.readFile(fullPath, "utf-8");
  }

  /**
   * Get all available templates from repository
   */
  async listTemplates(repoUrl: string): Promise<string[]> {
    const repoPath = this.getRepoPath(repoUrl);
    const files = await glob("**/*.md", {
      cwd: repoPath,
      ignore: ["node_modules/**", ".git/**"]
    });
    return files;
  }

  /**
   * Load template metadata
   */
  async loadMetadata(repoUrl: string): Promise<TemplateMetadata> {
    const metadataPath = path.join(
      this.getRepoPath(repoUrl),
      ".agentcookbook-templates.yaml"
    );

    if (await fs.pathExists(metadataPath)) {
      const content = await fs.readFile(metadataPath, "utf-8");
      return yaml.load(content) as TemplateMetadata;
    }

    return { version: "1.0.0", templates: [] };
  }

  private getRepoPath(repoUrl: string): string {
    const repoName = path.basename(repoUrl, ".git");
    return path.join(this.cacheDir, repoName);
  }

  private async repoExists(repoPath: string): Promise<boolean> {
    return await fs.pathExists(path.join(repoPath, ".git"));
  }
}
```

## CLI Entry Point (`src/index.ts`)

```typescript
#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { initCommand } from "./commands/init";
import { updateCommand } from "./commands/update";
import { syncCommand } from "./commands/sync";
import { validateCommand } from "./commands/validate";
import { configCommand } from "./commands/config";

const program = new Command();

program
  .name("agent-cookbook")
  .description("Manage AGENTS.md files across your codebase")
  .version("1.0.0");

program
  .command("init")
  .description("Initialize project with AGENTS.md templates")
  .option("-r, --repo <url>", "Template repository URL")
  .option("-c, --config <path>", "Path to config file")
  .option("-f, --force", "Overwrite existing files")
  .option("-i, --interactive", "Interactive setup")
  .option("--dry-run", "Show what would be created")
  .action(initCommand);

program
  .command("update")
  .description("Update AGENTS.md files from template repository")
  .argument("[templates...]", "Specific templates to update")
  .option("-s, --strategy <type>", "Merge strategy", "preserve-project")
  .option("-f, --force", "Overwrite without merging")
  .option("--dry-run", "Show what would be updated")
  .option("--conflict <action>", "Conflict resolution", "manual")
  .action(updateCommand);

program
  .command("sync")
  .description("Sync specific template or check sync status")
  .argument("[template]", "Template name to sync")
  .option("--check-only", "Only check if in sync")
  .option("-f, --force", "Force sync")
  .action(syncCommand);

program
  .command("validate")
  .description("Validate AGENTS.md files structure")
  .option("--fix", "Auto-fix issues")
  .option("--strict", "Fail on warnings")
  .action(validateCommand);

program
  .command("config")
  .description("Manage configuration")
  .argument("<action>", "Action to perform")
  .argument("[args...]", "Action arguments")
  .action(configCommand);

program.parse();
```

## Workflow Examples

### Example 1: First-Time Setup

```bash
# Initialize in a new project
$ cd my-project
$ agent-cookbook init --interactive

? Enter template repository URL: git@github.com:team/agent-templates.git
? Enter app name: user-service
? Enter namespace: com.company.users

✓ Created 5 AGENTS.md files
```

### Example 2: Daily Development

Developer works in `src/api/user-service/` and adds project-specific notes to AGENTS.md:

```markdown
<!-- PROJECT_SPECIFIC -->

## Project-Specific Notes

### Database Connection
- Uses PostgreSQL on port 5432
- Connection pool size: 20

### Authentication
- JWT tokens with 24h expiry
- Refresh tokens stored in Redis
```

### Example 3: Template Updates

Team updates the API template with new best practices:

```bash
$ agent-cookbook update

✓ Updated 3 files
✓ Project-specific content preserved
```

The developer's custom notes remain intact while getting new template content.

### Example 4: Adding New Modules

Project adds a new microservice:

```bash
# Update variables in config
$ agent-cookbook config set-variable appName notification-service

# Re-run init to create new AGENTS.md files
$ agent-cookbook init

✓ Created AGENTS.md for notification-service
```

### Example 5: Validation Before Commit

```bash
# In CI/CD or pre-commit hook
$ agent-cookbook validate --strict

✓ All AGENTS.md files are valid
✓ All required sections present
✓ All delimiters in place
```

## Installation & Distribution

### Package.json Configuration

```json
{
  "name": "agent-cookbook-cli",
  "version": "1.0.0",
  "description": "Manage AGENTS.md files for coding agents",
  "bin": {
    "agent-cookbook": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/index.ts",
    "test": "jest",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "inquirer": "^9.2.0",
    "chalk": "^5.3.0",
    "fs-extra": "^11.1.1",
    "js-yaml": "^4.1.0",
    "simple-git": "^3.19.0",
    "fast-glob": "^3.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/inquirer": "^9.0.0",
    "@types/fs-extra": "^11.0.0",
    "@types/js-yaml": "^4.0.5",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0",
    "jest": "^29.0.0"
  }
}
```

### Installation Methods

**NPM Global Install**:
```bash
npm install -g agent-cookbook-cli
```

**Project-specific (recommended)**:
```bash
npm install --save-dev agent-cookbook-cli
```

Then use via npm scripts:
```json
{
  "scripts": {
    "agents:init": "agent-cookbook init",
    "agents:update": "agent-cookbook update",
    "agents:validate": "agent-cookbook validate"
  }
}
```

## Testing Strategy

### Unit Tests
- Path resolution with various variable combinations
- Template merging logic
- Conflict detection
- Configuration loading and validation

### Integration Tests
- End-to-end init workflow
- Update with merge scenarios
- Git operations
- File system operations

### Test Structure
```
tests/
├── unit/
│   ├── path-resolver.test.ts
│   ├── merger.test.ts
│   └── config-loader.test.ts
├── integration/
│   ├── init.test.ts
│   ├── update.test.ts
│   └── sync.test.ts
└── fixtures/
    ├── sample-repo/
    └── sample-project/
```

## Error Handling

### Common Errors and Messages

1. **Missing Configuration**:
```
❌ No .agentcookbook.yaml found
Run 'agent-cookbook init' to set up your project
```

2. **Missing Variables**:
```
❌ Missing required variable: 'appName'
Define in .agentcookbook.yaml under 'variables' section
```

3. **Template Not Found**:
```
❌ Template 'backend/api/AGENTS.md' not found in repository
Available templates:
  - backend/database/AGENTS.md
  - frontend/components/AGENTS.md
```

4. **Merge Conflicts**:
```
⚠️  Merge conflict in src/api/user-service/AGENTS.md
Both template and project sections were modified
Use 'agent-cookbook resolve' or edit manually
```

5. **Git Access Issues**:
```
❌ Failed to clone repository
Check SSH keys or repository URL:
git@github.com:team/templates.git
```

## New Features Implementation

### 1. Recipes System

Recipes are reusable instructions for common tasks using your internal services and tools. They work similar to Claude skills - providing step-by-step guidance for specific operations.

#### Recipe Structure

Recipes are stored in the template repository under a `recipes/` folder:

```
agent-templates/
├── recipes/
│   ├── send-email.md
│   ├── handle-entitlements.md
│   ├── create-api-endpoint.md
│   ├── setup-database-migration.md
│   └── configure-auth.md
```

Each recipe is a markdown file with the following structure:

```markdown
# Recipe: Send Email Using Internal Service

## Description
How to send emails using our internal email service with proper formatting and tracking.

## Prerequisites
- Access to EmailService API
- Valid API key in environment variables
- Email templates repository cloned

## Steps

1. **Import the Email Service**
   ```typescript
   import { EmailService } from '@company/email-service';
   ```

2. **Initialize the Service**
   ```typescript
   const emailService = new EmailService({
     apiKey: process.env.EMAIL_API_KEY,
     environment: process.env.NODE_ENV
   });
   ```

3. **Prepare Email Data**
   ```typescript
   const emailData = {
     to: 'user@example.com',
     template: 'welcome-email',
     variables: {
       userName: 'John Doe',
       activationLink: generateActivationLink()
     }
   };
   ```

4. **Send Email**
   ```typescript
   const result = await emailService.send(emailData);
   ```

## Common Patterns

- **Transactional Emails**: Use templates from `templates/transactional/`
- **Marketing Emails**: Require opt-in check first
- **Error Handling**: Always catch and log errors to monitoring service

## Related Services
- Tracking Service: Log email opens/clicks
- Template Service: Manage email templates
- User Preferences: Check email opt-out status

## Examples

See `examples/email-service/` for complete working examples.
```

#### Recipe Metadata (`.agentcookbook-recipes.yaml`)

In the template repository:

```yaml
version: "1.0.0"
recipes:
  - name: "send-email"
    path: "recipes/send-email.md"
    description: "Send emails using internal email service"
    tags: ["email", "notifications", "backend"]
    services: ["EmailService", "TrackingService"]

  - name: "handle-entitlements"
    path: "recipes/handle-entitlements.md"
    description: "Check and manage user entitlements"
    tags: ["auth", "permissions", "security"]
    services: ["EntitlementService", "AuthService"]

  - name: "create-api-endpoint"
    path: "recipes/create-api-endpoint.md"
    description: "Create a new API endpoint following company standards"
    tags: ["api", "backend", "express"]
    services: ["Express", "ValidationService"]
```

#### Recipe Commands

```bash
# List all available recipes
agent-cookbook recipe list

# Search recipes by tag
agent-cookbook recipe list --tag email

# View a specific recipe
agent-cookbook recipe show send-email

# Copy recipe to local project
agent-cookbook recipe add send-email --output docs/recipes/

# Update recipes from template repo
agent-cookbook recipe update
```

#### Recipe Configuration in `.agentcookbook.yaml`

```yaml
recipes:
  enabled: true
  localPath: ".recipes"  # Where to store recipes locally
  includeInAgents: true  # Reference recipes in AGENTS.md files
```

#### Integration with AGENTS.md

Recipes can be referenced in AGENTS.md files:

```markdown
## Common Tasks

For common operations, refer to these recipes:

- {{recipe:send-email}} - Sending emails through our service
- {{recipe:handle-entitlements}} - Checking user permissions
- {{recipe:create-api-endpoint}} - Creating new API endpoints

See all recipes: `agent-cookbook recipe list`
```

### 2. Propose Changes Feature

Allow users to push their modified AGENTS.md files back to the template repository and create a pull request for review.

#### Workflow

1. User modifies AGENTS.md files locally (e.g., improves template section)
2. User runs `agent-cookbook propose`
3. CLI creates a new branch in template repo
4. CLI pushes template sections (not project-specific content) to the branch
5. CLI creates a pull request with changes

#### Command Implementation

```bash
agent-cookbook propose [options]

Options:
  -m, --message <message>    Commit message for the proposal
  -d, --description <desc>   PR description
  -t, --title <title>        PR title
  --templates <names...>     Specific templates to propose
  --branch <name>            Custom branch name
  --dry-run                  Show what would be proposed
```

#### Configuration

```yaml
propose:
  enabled: true
  requireReview: true
  branchPrefix: "proposed/"
  prLabels: ["template-update", "community-contribution"]
  defaultReviewers: ["template-maintainer"]
```

#### Propose Command Flow

1. **Extract Template Sections**: Parse local AGENTS.md files and extract only the template section (before delimiter)
2. **Compare with Upstream**: Compare extracted section with current template repo version
3. **Create Branch**: Create branch in format `proposed/update-{template-name}-{timestamp}`
4. **Commit Changes**: Commit only the template sections
5. **Push Branch**: Push to template repository
6. **Create PR**: Use GitHub API or `gh` CLI to create pull request
7. **Display PR URL**: Show user the PR URL for tracking

#### Example Output

```bash
$ agent-cookbook propose --message "Improve API error handling guidelines"

Proposing changes to template repository...

Analyzing changes:
✓ Backend API: Template section modified
✓ Frontend Components: No changes detected
  Database Migrations: Skipped (no local changes)

Creating proposal branch: proposed/update-backend-api-1699123456
✓ Branch created

Pushing changes to template repository...
✓ Changes pushed

Creating pull request...
✓ PR created: https://github.com/team/agent-templates/pull/123

Title: Update Backend API template
Description: Improve API error handling guidelines
Reviewers: @template-maintainer
Labels: template-update, community-contribution

Your proposal is ready for review!
```

### 3. Nested Folder Support

Enable copying entire folder structures from templates, not just individual files.

#### Template Structure

```
agent-templates/
├── backend/
│   └── api/
│       └── AGENTS.md
├── frontend/
│   └── angular/
│       ├── AGENTS.md
│       ├── src/
│       │   ├── app/
│       │   │   └── AGENTS.md
│       │   ├── components/
│       │   │   └── AGENTS.md
│       │   └── services/
│       │       └── AGENTS.md
│       └── tests/
│           └── AGENTS.md
```

#### Configuration

```yaml
mappings:
  # Single file mapping (default)
  - name: "Backend API"
    template: "backend/api/AGENTS.md"
    targetPath: "src/api/{{appName}}/AGENTS.md"
    type: "file"  # Optional: default is file

  # Folder mapping - copies entire structure
  - name: "Angular Project Structure"
    template: "frontend/angular/"
    targetPath: "src/{{appName}}/"
    type: "folder"
    recursive: true
    preserveStructure: true
```

#### Behavior

When `type: "folder"`:
- All AGENTS.md files in the folder structure are copied
- Directory structure is preserved
- Path variables are resolved in target paths
- During updates, each AGENTS.md file is merged individually

#### Example

Template repository has:
```
frontend/angular/
├── AGENTS.md
├── src/
│   ├── app/AGENTS.md
│   ├── components/AGENTS.md
│   └── services/AGENTS.md
```

With config:
```yaml
variables:
  appName: "payment-service"

mappings:
  - name: "Angular Structure"
    template: "frontend/angular/"
    targetPath: "src/{{appName}}/"
    type: "folder"
```

Results in:
```
src/payment-service/
├── AGENTS.md
├── src/
│   ├── app/AGENTS.md
│   ├── components/AGENTS.md
│   └── services/AGENTS.md
```

#### Filtering

Support glob patterns for selective copying:

```yaml
mappings:
  - name: "Angular Structure"
    template: "frontend/angular/"
    targetPath: "src/{{appName}}/"
    type: "folder"
    include:
      - "**/*.md"
      - "**/AGENTS.*"
    exclude:
      - "**/node_modules/**"
      - "**/.git/**"
```

### 4. Branch-aware Mappings

Allow different templates to pull from different branches in the git repository.

#### Configuration

```yaml
repository:
  url: "git@github.com:yourteam/agent-templates.git"
  branch: "main"  # Default branch

mappings:
  # Uses default branch (main)
  - name: "Backend API"
    template: "backend/api/AGENTS.md"
    targetPath: "src/api/{{appName}}/AGENTS.md"

  # Pulls from experimental branch
  - name: "New Frontend Framework"
    template: "frontend/react/AGENTS.md"
    targetPath: "src/frontend/{{appName}}/AGENTS.md"
    branch: "experimental"

  # Pulls from specific feature branch
  - name: "GraphQL API"
    template: "backend/graphql/AGENTS.md"
    targetPath: "src/graphql/{{appName}}/AGENTS.md"
    branch: "feature/graphql-support"

  # Pulls from version tag
  - name: "Legacy API"
    template: "backend/api-v1/AGENTS.md"
    targetPath: "src/api-v1/{{appName}}/AGENTS.md"
    branch: "v1.0.0"  # Git tag
```

#### Implementation Considerations

1. **Multiple Branch Checkouts**: Template manager needs to handle multiple branch checkouts
   - Option A: Clone repo multiple times (one per branch)
   - Option B: Use git worktrees
   - Option C: Checkout and cache files from each branch

2. **Cache Strategy**: Cache structure per branch
   ```
   .agent-cookbook-cache/
   ├── agent-templates/
   │   ├── main/
   │   │   └── backend/api/AGENTS.md
   │   ├── experimental/
   │   │   └── frontend/react/AGENTS.md
   │   └── feature-graphql-support/
   │       └── backend/graphql/AGENTS.md
   ```

3. **Update Behavior**: Each branch is updated independently

#### Command Updates

```bash
# Update all templates (all branches)
agent-cookbook update

# Update only templates from specific branch
agent-cookbook update --branch experimental

# Show branch info for templates
agent-cookbook config list --show-branches
```

#### Display Branch Info

```bash
$ agent-cookbook config list

Mappings:
  - Backend API
    Template: backend/api/AGENTS.md
    Branch: main (default)
    Target: src/api/{{appName}}/AGENTS.md

  - New Frontend Framework
    Template: frontend/react/AGENTS.md
    Branch: experimental
    Target: src/frontend/{{appName}}/AGENTS.md
```

## Advanced Features (Future Enhancements)

### 1. Template Inheritance
Allow templates to extend other templates:
```yaml
# In template metadata
templates:
  - path: "backend/api-v2/AGENTS.md"
    extends: "backend/api/AGENTS.md"
```

### 2. Conditional Sections
Support conditional content based on project variables:
```markdown
## Agent Instructions

{{#if language === "typescript"}}
### TypeScript Specific
- Use strict mode
{{/if}}

{{#if database === "postgres"}}
### PostgreSQL Patterns
- Use parameterized queries
{{/if}}
```

### 3. Multi-Repository Support
Support pulling templates from multiple repositories:
```yaml
repositories:
  - name: "company-standards"
    url: "git@github.com:company/templates.git"
  - name: "team-customs"
    url: "git@github.com:team/customs.git"

mappings:
  - template: "company-standards:backend/api/AGENTS.md"
    targetPath: "src/api/{{appName}}/AGENTS.md"
```

### 4. Template Versioning
Pin specific template versions:
```yaml
repository:
  url: "git@github.com:team/templates.git"
  version: "v2.1.0"  # Git tag or commit hash
```

### 5. Pre/Post Hooks
Run scripts before/after operations:
```yaml
hooks:
  preUpdate:
    - "npm run lint"
  postUpdate:
    - "npm run format-agents"
    - "git add ."
```

## Implementation Timeline

### Phase 1: Core Functionality (Week 1-2)
- Project structure setup
- Configuration loading
- Path resolution system
- Basic init command
- Template repository cloning

### Phase 2: Update & Merge (Week 3)
- Template merger implementation
- Update command
- Conflict detection
- Basic validation

### Phase 3: Polish & Testing (Week 4)
- Comprehensive error handling
- Unit and integration tests
- CLI UX improvements
- Documentation

### Phase 4: Advanced Features (Week 5+)
- Template inheritance
- Conditional sections
- Multi-repo support
- Hooks system

## Success Metrics

- **Adoption**: Number of projects using the tool
- **Template Updates**: Frequency of updates without merge conflicts
- **Time Saved**: Reduction in time spent on manual AGENTS.md maintenance
- **Consistency**: Percentage of projects with up-to-date templates

## Documentation Requirements

1. **README.md**: Quick start guide and basic usage
2. **CONTRIBUTING.md**: How to contribute templates
3. **Template Guide**: How to create good AGENTS.md templates
4. **Configuration Reference**: Complete config file documentation
5. **Migration Guide**: For existing projects adopting the tool

## Questions for Dev Huddle Discussion

1. **Variable Naming**: What conventions for path variables? (camelCase, snake_case, UPPER_CASE)
2. **Merge Conflicts**: Default strategy for conflicts? (manual, auto-template, auto-project)
3. **Template Repository**: Single repo or multiple? Public or private?
4. **Validation Rules**: What makes a good AGENTS.md file?
5. **CI/CD Integration**: Should validation run automatically in CI?
6. **Template Discovery**: How should developers find appropriate templates?
7. **Version Control**: Should AGENTS.md files be gitignored or committed?
8. **Feedback Loop**: How to improve templates based on agent performance?

## Conclusion

This implementation plan provides a solid foundation for building an Agent Cookbook CLI tool that will standardize how coding agents work across your codebase. The templatable path system ensures flexibility for different project structures while maintaining consistency in agent instructions.

The key innovation is the smart merge system that allows centralized template updates while preserving project-specific customizations, making it easy to keep agent instructions current across all projects.
