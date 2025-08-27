# Cursor Rules for Voddly Project

This directory contains project-specific rules for Cursor AI that help maintain code quality and enforce best practices.

## Available Rules

### `encore-client.mdc`

- **Type**: Always Applied
- **Scope**: All `encore-client.ts` files
- **Purpose**: Prevents manual editing of auto-generated Encore client files

### `project-overview.mdc`

- **Type**: Always Applied
- **Scope**: All project files
- **Purpose**: Provides general project context and workflows

## Rule Types

- **Always Applied**: Automatically included in all AI interactions
- **Auto Attached**: Included when files matching glob patterns are referenced
- **Agent Requested**: Available to AI, which decides whether to include
- **Manual**: Only included when explicitly mentioned using `@ruleName`

## How Rules Work

1. **Metadata Section**: YAML frontmatter defining rule behavior
2. **Content**: Markdown content explaining the rule
3. **Globs**: File patterns that trigger the rule
4. **Always Apply**: Whether the rule is always active

## Adding New Rules

1. Create a new `.mdc` file in this directory
2. Include proper metadata section at the top
3. Write clear, actionable content
4. Test the rule with Cursor AI

## Example Rule Structure

```mdc
---
description: Brief description of the rule
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: false
---

# Rule Title

Rule content goes here...
```

## Current Rules Status

- ✅ `encore-client.mdc` - Prevents manual editing of generated files
- ✅ `project-overview.mdc` - Provides project context
- 🔄 Additional rules can be added as needed
