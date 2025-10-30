# Agent Cookbook CLI

A CLI tool that manages AGENTS.md files across a codebase by downloading templates from a repository and intelligently merging updates while preserving project-specific customizations.

## Features

- **Template Path Variables** - Support for dynamic path resolution with `{{variable}}` syntax
- **Initialize Project** - Seed your project with AGENTS.md files from a template repository
- **Update from Repository** - Pull latest template changes while preserving your customizations
- **Smart Merging** - Automatically preserve project-specific content during updates
- **Validation** - Ensure AGENTS.md files follow expected structure
- **Recipes** - Reusable instructions for common tasks using your internal services (like Claude skills)
- **Propose Changes** - Push your improvements back to the template repo and create pull requests
- **Nested Folder Support** - Copy entire folder structures with multiple AGENTS.md files
- **Branch-aware Mappings** - Pull different templates from different git branches

## Installation

### Global Installation

```bash
npm install -g agent-cookbook-cli
```

### Project-specific Installation (Recommended)

```bash
npm install --save-dev agent-cookbook-cli
```

Then add to your `package.json` scripts:

```json
{
  "scripts": {
    "agents:init": "agent-cookbook init",
    "agents:update": "agent-cookbook update",
    "agents:validate": "agent-cookbook validate"
  }
}
```

## Quick Start

### 1. Initialize Your Project

```bash
agent-cookbook init --interactive
```

This will prompt you for:
- Template repository URL
- Application name
- Namespace (optional)
- API version (optional)

### 2. Configure Mappings

Edit the generated `.agentcookbook.yaml` file to add template mappings:

```yaml
repository:
  url: "git@github.com:yourteam/agent-templates.git"
  branch: "main"

variables:
  appName: "my-awesome-app"
  namespace: "com.company"
  apiVersion: "v1"

mappings:
  # Single file mapping
  - name: "Backend API"
    template: "backend/api/AGENTS.md"
    targetPath: "src/api/{{appName}}/AGENTS.md"

  # Folder mapping - copies entire folder structure
  - name: "Angular Project"
    template: "frontend/angular/"
    targetPath: "src/{{appName}}/"
    type: "folder"
    include:
      - "**/*.md"
    exclude:
      - "**/node_modules/**"

  # Branch-specific template
  - name: "Experimental Features"
    template: "backend/graphql/AGENTS.md"
    targetPath: "src/graphql/{{appName}}/AGENTS.md"
    branch: "experimental"
```

### 3. Create AGENTS.md Files

```bash
agent-cookbook init
```

### 4. Update Templates

When the template repository is updated:

```bash
agent-cookbook update
```

Your project-specific content (after the `<!-- PROJECT_SPECIFIC -->` delimiter) will be preserved!

## Commands

### `init`

Initialize project with AGENTS.md templates.

```bash
agent-cookbook init [options]
```

**Options:**
- `-r, --repo <url>` - Template repository URL
- `-c, --config <path>` - Path to config file
- `-f, --force` - Overwrite existing files
- `-i, --interactive` - Interactive setup (default)
- `--dry-run` - Show what would be created

**Example:**
```bash
agent-cookbook init --repo git@github.com:team/templates.git
```

### `update`

Update AGENTS.md files from template repository.

```bash
agent-cookbook update [templates...] [options]
```

**Arguments:**
- `templates` - Specific template names to update (optional)

**Options:**
- `-s, --strategy <type>` - Merge strategy (preserve-project|three-way)
- `-f, --force` - Overwrite without merging
- `--dry-run` - Show what would be updated
- `--conflict <action>` - Conflict resolution (manual|auto-template|auto-project)

**Examples:**
```bash
# Update all templates
agent-cookbook update

# Update specific templates
agent-cookbook update "Backend API" "Frontend Components"

# Dry run to see what would change
agent-cookbook update --dry-run
```

### `validate`

Validate AGENTS.md files structure.

```bash
agent-cookbook validate [options]
```

**Options:**
- `--fix` - Auto-fix issues where possible
- `--strict` - Fail on warnings (useful for CI/CD)

**Example:**
```bash
# Validate all files
agent-cookbook validate

# Validate and auto-fix issues
agent-cookbook validate --fix

# Strict validation for CI/CD
agent-cookbook validate --strict
```

### `sync`

Check sync status or sync specific templates.

```bash
agent-cookbook sync [template] [options]
```

**Arguments:**
- `template` - Template name to check/sync (optional)

**Options:**
- `--check-only` - Only check if files are in sync
- `-f, --force` - Force sync even if up to date

**Examples:**
```bash
# Check all templates sync status
agent-cookbook sync --check-only

# Sync specific template
agent-cookbook sync "Backend API"
```

### `config`

Manage configuration and variables.

```bash
agent-cookbook config <action> [args...]
```

**Actions:**
- `get <key>` - Get a configuration value
- `list` - List all configuration
- `set-variable <key> <value>` - Set a path variable
- `add-mapping` - Add a new template mapping (interactive)
- `remove-mapping <name>` - Remove a template mapping

**Examples:**
```bash
# List all configuration
agent-cookbook config list

# Get repository URL
agent-cookbook config get repository.url

# Set a variable
agent-cookbook config set-variable appName new-service

# Add a new mapping interactively
agent-cookbook config add-mapping

# Remove a mapping
agent-cookbook config remove-mapping "Backend API"
```

### `recipe`

Manage and use recipes - reusable instructions for common tasks using your internal services.

```bash
agent-cookbook recipe <action> [args...] [options]
```

**Actions:**
- `list` - List all available recipes
- `list --tag <tag>` - Filter recipes by tag
- `show <name>` - Display recipe content and details
- `add <name>` - Copy recipe to local project (default: docs/recipes/)
- `update` - Sync recipes from template repository

**Examples:**
```bash
# List all available recipes
agent-cookbook recipe list

# Filter recipes by tag
agent-cookbook recipe list --tag email

# View a specific recipe
agent-cookbook recipe show send-email

# Add recipe to your project
agent-cookbook recipe add send-email

# Add recipe to custom path
agent-cookbook recipe add send-email --output my-recipes/

# Update all recipes from template repo
agent-cookbook recipe update
```

### `propose`

Propose your template improvements back to the template repository via pull request.

```bash
agent-cookbook propose [options]
```

**Options:**
- `-m, --message <message>` - Commit message for the proposal
- `-d, --description <desc>` - PR description
- `-t, --title <title>` - PR title
- `--templates <names...>` - Specific templates to propose
- `--branch <name>` - Custom branch name
- `--dry-run` - Show what would be proposed

**Prerequisites:**
- GitHub CLI (`gh`) must be installed and authenticated
- Write access to template repository

**Examples:**
```bash
# Propose all changed templates
agent-cookbook propose

# Propose specific templates with custom message
agent-cookbook propose --templates "Backend API" -m "Improve error handling"

# Preview what would be proposed
agent-cookbook propose --dry-run

# Full customization
agent-cookbook propose \
  -m "Add GraphQL examples" \
  -t "Update API template with GraphQL" \
  -d "Added comprehensive GraphQL examples and patterns"
```

## Configuration File

The `.agentcookbook.yaml` file controls how the CLI operates:

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

# Template mappings
mappings:
  - name: "Backend API"
    template: "backend/api/AGENTS.md"
    targetPath: "src/api/{{appName}}/AGENTS.md"

# Merge configuration
merge:
  delimiter: "<!-- PROJECT_SPECIFIC -->"
  strategy: "preserve-project"
  conflictResolution: "manual"

# Validation rules
validation:
  requireDelimiter: true
  maxFileSize: "50kb"
  allowedSections:
    - "Overview"
    - "Folder Purpose"
    - "Agent Instructions"
    - "Project Specific"

# Recipes configuration
recipes:
  enabled: true
  localPath: ".recipes"
  includeInAgents: true

# Propose changes configuration
propose:
  enabled: true
  requireReview: true
  branchPrefix: "proposed/"
  prLabels:
    - template-update
    - community-contribution
  defaultReviewers:
    - template-maintainer
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

<!-- PROJECT_SPECIFIC -->

## Project-Specific Notes

[This section is preserved during updates]

### Custom Requirements
- Project-specific rules
- Team conventions
```

Everything **before** the delimiter (`<!-- PROJECT_SPECIFIC -->`) comes from the template and will be updated when you run `agent-cookbook update`.

Everything **after** the delimiter is your project-specific content and will be preserved during updates.

## Path Variables

Use `{{variableName}}` syntax in target paths to create dynamic paths:

```yaml
variables:
  appName: "payment-service"
  namespace: "com.company.payments"

mappings:
  - name: "API Handler"
    template: "backend/api/AGENTS.md"
    targetPath: "src/api/{{appName}}/AGENTS.md"
    # Resolves to: src/api/payment-service/AGENTS.md

  - name: "Database"
    template: "backend/database/AGENTS.md"
    targetPath: "src/database/{{namespace}}/AGENTS.md"
    # Resolves to: src/database/com.company.payments/AGENTS.md
```

## Workflow Examples

### First-Time Setup

```bash
# Initialize with interactive prompts
cd my-project
agent-cookbook init --interactive

# Edit .agentcookbook.yaml to add mappings
vim .agentcookbook.yaml

# Create AGENTS.md files
agent-cookbook init
```

### Daily Development

Work in your code folders and add project-specific notes to AGENTS.md:

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

### Pulling Template Updates

When your team updates the template repository:

```bash
# Pull latest templates
agent-cookbook update

# Your custom notes are preserved!
```

### CI/CD Integration

Add validation to your CI pipeline:

```bash
# In your CI/CD script
agent-cookbook validate --strict
```

## Advanced Features

### Recipes System

Recipes are reusable instructions for common tasks using your internal services - like sending emails, handling entitlements, or creating API endpoints. They work similar to Claude skills.

**Recipe Structure in Template Repository:**

```
agent-templates/
├── recipes/
│   ├── send-email.md
│   ├── handle-entitlements.md
│   ├── create-api-endpoint.md
│   └── setup-database-migration.md
└── .agentcookbook-recipes.yaml
```

**Usage:**

```bash
# List all recipes
agent-cookbook recipe list

# Search by tag
agent-cookbook recipe list --tag email

# View recipe details
agent-cookbook recipe show send-email

# Copy to your project
agent-cookbook recipe add send-email
```

**Configuration:**

```yaml
recipes:
  enabled: true
  localPath: ".recipes"
  includeInAgents: true
```

### Nested Folder Support

Copy entire folder structures with multiple AGENTS.md files from your template repository:

```yaml
mappings:
  - name: "Angular Project Structure"
    template: "frontend/angular/"
    targetPath: "src/{{appName}}/"
    type: "folder"
    recursive: true
    preserveStructure: true
    include:
      - "**/*.md"
      - "**/AGENTS.*"
    exclude:
      - "**/node_modules/**"
      - "**/.git/**"
```

This will copy all matching files from the template folder while preserving the directory structure:

```
Template: frontend/angular/
├── AGENTS.md
├── src/
│   ├── app/AGENTS.md
│   └── components/AGENTS.md

Result: src/payment-service/
├── AGENTS.md
├── src/
│   ├── app/AGENTS.md
│   └── components/AGENTS.md
```

### Branch-aware Mappings

Pull different templates from different branches in your git repository:

```yaml
repository:
  url: "git@github.com:yourteam/agent-templates.git"
  branch: "main"  # Default branch

mappings:
  # Uses default branch
  - name: "Backend API"
    template: "backend/api/AGENTS.md"
    targetPath: "src/api/{{appName}}/AGENTS.md"

  # Pulls from experimental branch
  - name: "New Features"
    template: "frontend/next-gen/AGENTS.md"
    targetPath: "src/frontend/AGENTS.md"
    branch: "experimental"

  # Pulls from specific tag
  - name: "Legacy API"
    template: "backend/api-v1/AGENTS.md"
    targetPath: "src/api-v1/AGENTS.md"
    branch: "v1.0.0"
```

**Update from specific branch:**

```bash
# Update only templates from experimental branch
agent-cookbook update --branch experimental
```

### Proposing Changes Back

Improve templates and share them with your team:

```bash
# Make improvements to your local AGENTS.md files
vim src/api/my-app/AGENTS.md

# Propose changes back to template repo
agent-cookbook propose -m "Add error handling best practices"
```

This will:
1. Extract only the template sections (before delimiter)
2. Compare with upstream
3. Create a new branch in the template repo
4. Push changes
5. Create a pull request for review

## Development

### Build from Source

```bash
# Clone the repository
git clone git@github.com:yourteam/agent-cookbook-cli.git
cd agent-cookbook-cli

# Install dependencies
npm install

# Build
npm run build

# Run locally
npm run dev -- init --help
```

### Run Tests

```bash
npm test
```

## License

MIT

## Contributing

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed architecture and implementation details.

## Support

For issues and questions, please open an issue on GitHub.
