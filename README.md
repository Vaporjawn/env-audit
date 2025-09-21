# EnvAudit 🔍

A comprehensive TypeScript tool for scanning codebases and generating environment variable documentation. EnvAudit automatically discovers environment variables from multiple sources and generates `.env.example` files, JSON schemas, and documentation.

[![npm version](https://badge.fury.io/js/envaudit.svg)](https://badge.fury.io/js/envaudit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

## ✨ Features

- **🔍 Multi-Source Detection**: Scans JavaScript/TypeScript, .env files, Docker Compose, GitHub Actions, and shell scripts
- **🎯 Framework-Aware**: Automatically detects and handles Next.js, Vite, Create React App, and more
- **📝 Multiple Output Formats**: Generates `.env.example`, JSON Schema, and Markdown documentation
- **🔒 Security-Focused**: Identifies public vs private variables and potential security issues
- **⚡ Fast & Reliable**: Built with modern TypeScript and comprehensive error handling
- **🎨 CLI & Programmatic API**: Use as a command-line tool or integrate into your workflow
- **🧪 Thoroughly Tested**: Comprehensive test suite with 95%+ coverage

## 📦 Installation

### Global Installation (Recommended for CLI usage)

```bash
npm install -g envaudit
```

### Local Installation

```bash
# npm
npm install envaudit

# yarn
yarn add envaudit

# pnpm
pnpm add envaudit
```

## 🚀 Quick Start

### CLI Usage

```bash
# Scan current directory and generate all output formats
envaudit scan

# Scan specific directory with custom output
envaudit scan ./my-project --output ./docs --format all

# Check if .env.example is up to date
envaudit check

# Print variables to stdout
envaudit print --format json
```

### Programmatic Usage

```typescript
import { Scanner } from 'envaudit';

const scanner = new Scanner();
const result = await scanner.scan('./my-project');

console.log(`Found ${result.findings.length} environment variables`);
console.log(`Framework: ${result.framework}`);
```

## 📖 Documentation

### CLI Commands

#### `scan` - Scan and Generate Documentation

Scans your codebase for environment variables and generates documentation.

```bash
envaudit scan [directory] [options]
```

**Arguments:**
- `directory` - Directory to scan (default: current directory)

**Options:**
- `-o, --output <path>` - Output directory for generated files (default: scanned directory)
- `-f, --format <format>` - Output format: `env`, `json`, `md`, or `all` (default: `env`)
- `-i, --include <pattern>` - Include file patterns (can be used multiple times)
- `-e, --exclude <pattern>` - Exclude file patterns (can be used multiple times)
- `--exclude-provider <name>` - Exclude specific providers (`ast`, `dotenv`, `yaml`, `shell`)
- `--public-prefix <prefix>` - Custom public variable prefixes (can be used multiple times)
- `--no-follow-symlinks` - Don't follow symbolic links
- `--max-file-size <bytes>` - Maximum file size to scan (default: 1MB)
- `-v, --verbose` - Enable verbose logging
- `-q, --quiet` - Suppress output except errors

**Examples:**

```bash
# Basic scan with .env.example output
envaudit scan

# Scan with all output formats
envaudit scan --format all

# Scan only TypeScript files
envaudit scan --include "**/*.ts" --include "**/*.tsx"

# Exclude test files and node_modules
envaudit scan --exclude "**/test/**" --exclude "**/node_modules/**"

# Custom public prefixes for different frameworks
envaudit scan --public-prefix "REACT_APP_" --public-prefix "VITE_"

# Verbose output for debugging
envaudit scan --verbose
```

#### `check` - Validate Environment Configuration

Validates that your environment configuration is complete and up-to-date.

```bash
envaudit check [directory] [options]
```

**Arguments:**
- `directory` - Directory to scan (default: current directory)

**Options:**
- `-r, --reference <file>` - Reference file to check against (default: `.env.example`)
- `--strict` - Fail on any discrepancies
- `-v, --verbose` - Enable verbose logging

**Examples:**

```bash
# Check against .env.example
envaudit check

# Check against custom reference file
envaudit check --reference .env.local

# Strict mode - fail on any missing variables
envaudit check --strict
```

#### `print` - Output to Console

Prints environment variable documentation to stdout.

```bash
envaudit print [directory] [options]
```

**Arguments:**
- `directory` - Directory to scan (default: current directory)

**Options:**
- `-f, --format <format>` - Output format: `env`, `json`, or `md` (default: `env`)
- All scan options are also available

**Examples:**

```bash
# Print .env format to stdout
envaudit print

# Print JSON schema
envaudit print --format json

# Print Markdown documentation
envaudit print --format md

# Pipe to file
envaudit print --format md > ENVIRONMENT.md
```

### Programmatic API

#### Scanner Class

The main class for scanning projects and detecting environment variables.

```typescript
import { Scanner } from 'envaudit';

const scanner = new Scanner();
```

**Methods:**

##### `scan(directory: string, options?: ScanOptions): Promise<ScanResult>`

Scans a directory for environment variables.

```typescript
const result = await scanner.scan('./my-project', {
  includePatterns: ['src/**/*.ts'],
  excludePatterns: ['**/*.test.ts'],
  publicPrefixes: ['VITE_', 'REACT_APP_'],
  logLevel: 'info'
});
```

#### Output Writers

Generate different output formats from scan results.

```typescript
import { EnvExampleWriter, JsonSchemaWriter, MarkdownWriter } from 'envaudit';

const envWriter = new EnvExampleWriter();
const jsonWriter = new JsonSchemaWriter();
const mdWriter = new MarkdownWriter();

// Generate .env.example
await envWriter.write(scanResult, '.env.example');

// Generate JSON schema
await jsonWriter.write(scanResult, 'schema.json');

// Generate Markdown documentation
await mdWriter.write(scanResult, 'ENVIRONMENT.md');
```

#### Type Definitions

##### `ScanOptions`

```typescript
interface ScanOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  excludeProviders?: string[];
  publicPrefixes?: string[];
  followSymlinks?: boolean;
  maxFileSize?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}
```

##### `ScanResult`

```typescript
interface ScanResult {
  findings: Finding[];
  stats: ScanStats;
  options: ScanOptions;
  framework?: string;
  scannedAt: string;
}
```

##### `Finding`

```typescript
interface Finding {
  name: string;
  source: 'ast' | 'dotenv' | 'docker' | 'gha' | 'shell';
  files: FileReference[];
  required?: boolean;
  defaultValue?: string;
  isPublic?: boolean;
}
```

## 🎯 Framework Support

EnvAudit automatically detects and provides specialized support for popular frameworks:

### Next.js

- Detects `next.config.js` and Next.js dependencies
- Recognizes `NEXT_PUBLIC_*` variables as public
- Provides Next.js-specific documentation and examples

```typescript
// Detected automatically
const apiUrl = process.env.NEXT_PUBLIC_API_URL; // Public
const dbUrl = process.env.DATABASE_URL; // Private
```

### Vite

- Detects `vite.config.*` and Vite dependencies
- Recognizes `VITE_*` variables as public
- Handles `import.meta.env` usage

```typescript
// Detected automatically
const apiUrl = import.meta.env.VITE_API_URL; // Public
const nodeEnv = import.meta.env.MODE; // Built-in Vite variable
```

### Create React App

- Detects `react-scripts` dependency
- Recognizes `REACT_APP_*` variables as public
- Handles CRA-specific patterns

```typescript
// Detected automatically
const apiUrl = process.env.REACT_APP_API_URL; // Public
```

### Generic Node.js

- Default framework for Node.js projects
- All variables treated as private by default
- Supports custom public prefixes

## 🔍 Detection Sources

### JavaScript/TypeScript (AST Provider)

Analyzes your code using Babel AST parsing to find:

- `process.env.VARIABLE_NAME`
- `import.meta.env.VARIABLE_NAME`
- Destructuring patterns: `const { API_URL } = process.env`
- Dynamic access with default values

```typescript
// All of these are detected
const dbUrl = process.env.DATABASE_URL;
const port = Number(process.env.PORT || 3000);
const { API_KEY, SECRET } = process.env;
const config = import.meta.env.VITE_CONFIG;
```

### Environment Files (Dotenv Provider)

Parses `.env*` files to find variable definitions:

```bash
# .env.example
DATABASE_URL=postgresql://localhost:5432/myapp
PORT=3000
NODE_ENV=development

# Supports comments and complex values
API_URL=https://api.example.com # Production API
SECRET_KEY="complex-value-with-spaces"
```

### Docker Compose (YAML Provider)

Extracts environment variables from Docker Compose files:

```yaml
# docker-compose.yml
version: '3.8'
services:
  web:
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
    env_file:
      - .env
```

### GitHub Actions (YAML Provider)

Finds environment variables in workflow files:

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    env:
      NODE_ENV: test
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
    steps:
      - name: Test
        env:
          API_TOKEN: ${{ secrets.API_TOKEN }}
```

### Shell Scripts (Shell Provider)

Detects variables in shell scripts:

```bash
#!/bin/bash
# deploy.sh

export NODE_ENV=production
DATABASE_URL=${DATABASE_URL:-"postgresql://localhost:5432/myapp"}

if [ -z "$API_KEY" ]; then
  echo "API_KEY is required"
  exit 1
fi
```

## 📄 Output Formats

### .env.example

Generates a standard `.env.example` file with all discovered variables:

```bash
# Environment Variables
# Generated by EnvAudit on 2024-01-01T00:00:00.000Z
#
# Total variables: 8
# Files scanned: 24
# Framework: Next.js

# =============================================================================
# Next.js Variables
# =============================================================================

# Required
NEXT_PUBLIC_API_URL=https://example.com
# Found in: src/config.ts:5
# Public variable - available in client-side code

DATABASE_URL=postgresql://user:password@localhost:5432/database
# Found in: src/db.ts:10, docker-compose.yml:8
# Private variable - server-side only

# Optional
PORT=3000
# Found in: src/server.ts:15
# Default value provided
```

### JSON Schema

Creates a JSON Schema for validation and tooling integration:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Environment Variables Schema",
  "type": "object",
  "properties": {
    "DATABASE_URL": {
      "type": "string",
      "description": "Database connection string",
      "pattern": "^postgresql://",
      "examples": ["postgresql://localhost:5432/myapp"],
      "x-source": "ast",
      "x-public": false,
      "x-files": [
        { "path": "src/db.ts", "line": 10 }
      ]
    }
  },
  "required": ["DATABASE_URL", "NEXT_PUBLIC_API_URL"],
  "x-envaudit": {
    "version": "1.0.0",
    "framework": "nextjs",
    "generatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Markdown Documentation

Comprehensive documentation with tables, badges, and framework-specific notes:

```markdown
# Environment Variables Documentation

## Summary

**Total Variables**: 8
**Required Variables**: 6
**Optional Variables**: 2
**Public Variables**: 2
**Framework**: Next.js

## Variables Overview

| Variable | Required | Public | Default | Source |
|----------|----------|--------|---------|--------|
| `DATABASE_URL` | ✅ | ❌ | - | Code |
| `NEXT_PUBLIC_API_URL` | ✅ | ✅ | - | Code |

## Variable Details

### `DATABASE_URL`

![Required](https://img.shields.io/badge/Required-red)
![Private](https://img.shields.io/badge/Private-orange)
![Source](https://img.shields.io/badge/Source-AST-blue)

Database connection string for the application.

**Files:**
- [`src/db.ts`](src/db.ts) - Line 10
- [`docker-compose.yml`](docker-compose.yml) - Line 8

**Example:**
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/database
```
```

## ⚙️ Configuration

### Configuration File

Create a `.envauditrc.json` file in your project root:

```json
{
  "includePatterns": ["src/**/*.{ts,js,tsx,jsx}"],
  "excludePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/*.test.*"
  ],
  "publicPrefixes": ["VITE_", "REACT_APP_"],
  "outputFormats": ["env", "md"],
  "outputDir": "./docs",
  "logLevel": "info"
}
```

### Package.json Scripts

Add EnvAudit to your build process:

```json
{
  "scripts": {
    "env:scan": "envaudit scan",
    "env:check": "envaudit check",
    "env:docs": "envaudit scan --format md --output ./docs",
    "prebuild": "envaudit check"
  }
}
```

### CI/CD Integration

#### GitHub Actions

```yaml
name: Environment Check
on: [push, pull_request]

jobs:
  env-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install -g envaudit
      - run: envaudit check --strict
      - run: envaudit scan --format all
      - uses: actions/upload-artifact@v3
        with:
          name: env-docs
          path: |
            .env.example
            schema.json
            ENVIRONMENT.md
```

#### Pre-commit Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "envaudit check"
    }
  }
}
```

## 🔧 Advanced Usage

### Custom Providers

Extend EnvAudit with custom detection logic:

```typescript
import { Provider, Finding } from 'envaudit';

class CustomProvider implements Provider {
  name = 'custom';
  supportedExtensions = ['.custom'];

  async scan(filePath: string, content: string): Promise<Finding[]> {
    // Custom scanning logic
    return [];
  }
}

const scanner = new Scanner();
scanner.addProvider(new CustomProvider());
```

### Filtering and Validation

```typescript
import { Scanner } from 'envaudit';

const scanner = new Scanner();
const result = await scanner.scan('./project');

// Filter findings
const publicVars = result.findings.filter(f => f.isPublic);
const requiredVars = result.findings.filter(f => f.required);

// Validate against schema
const missingVars = requiredVars.filter(v => !process.env[v.name]);
if (missingVars.length > 0) {
  throw new Error(`Missing required variables: ${missingVars.map(v => v.name).join(', ')}`);
}
```

### Custom Output Writers

```typescript
import { OutputWriter, ScanResult } from 'envaudit';

class CustomWriter implements OutputWriter {
  name = 'custom';
  fileExtension = '.custom';

  async write(result: ScanResult, outputPath: string): Promise<void> {
    // Custom output generation
  }
}
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test files
npm test -- providers
npm test -- cli
npm test -- integration
```

### Test Structure

```
tests/
├── integration.test.ts    # End-to-end functionality
├── providers.test.ts      # Provider implementations
├── utils.test.ts         # Utility functions
├── writers.test.ts       # Output writers
└── cli.test.ts          # CLI interface
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vaporjawn/env-audit.git
   cd envaudit
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run in development mode:**
   ```bash
   npm run dev
   ```

4. **Build the project:**
   ```bash
   npm run build
   ```

5. **Run tests:**
   ```bash
   npm test
   ```

### Code Quality

This project maintains high code quality standards:

- **TypeScript**: Strict type checking enabled
- **ESLint**: Comprehensive linting rules
- **Prettier**: Consistent code formatting
- **Vitest**: Fast and modern testing framework
- **Test Coverage**: Aim for 95%+ coverage

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Lint your code: `npm run lint`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Reporting Issues

Please use the [GitHub Issues](https://github.com/vaporjawn/env-audit/issues) page to report bugs or request features. Include:

- **Environment details** (Node.js version, OS, etc.)
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Sample code or repository** if applicable

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes.

## 🔒 Security

Security is a top priority. If you discover a security vulnerability, please:

1. **Do NOT** open a public issue
2. Email security@yourcompany.com
3. Include detailed information about the vulnerability
4. Allow time for the issue to be addressed before public disclosure

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Babel** - For robust AST parsing capabilities
- **Commander.js** - For excellent CLI framework
- **fast-glob** - For efficient file system scanning
- **Vitest** - For modern and fast testing

## 📚 Resources

- **Documentation**: Visit our [GitHub Repository](https://github.com/vaporjawn/env-audit)
- **Examples**: [Example Projects](https://github.com/vaporjawn/env-audit/tree/main/examples)
- **Issues**: [Report Issues](https://github.com/vaporjawn/env-audit/issues)
- **Community**: Join our [GitHub Discussions](https://github.com/vaporjawn/env-audit/discussions)

## 🔮 Roadmap

- [ ] **IDE Extensions** - VS Code and JetBrains plugins
- [ ] **Config Validation** - Real-time validation in editors
- [ ] **Environment Diff** - Compare configurations across environments
- [ ] **Secret Detection** - Identify potential secrets in code
- [ ] **Performance Analysis** - Optimize scanning for large codebases
- [ ] **Cloud Integration** - Direct integration with cloud providers

---

**Made with ❤️ by the EnvAudit Team**

[![GitHub Stars](https://img.shields.io/github/stars/vaporjawn/env-audit?style=social)](https://github.com/vaporjawn/env-audit)
[![Twitter Follow](https://img.shields.io/twitter/follow/envaudit?style=social)](https://twitter.com/envaudit)