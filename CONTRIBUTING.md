# Contributing to EnvAudit

Thank ## 🚀 Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/vaporjawn/env-audit.gitr your interest in contributing to EnvAudit! This guide will help you get started with contributing to this project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing Guidelines](#testing-guidelines)
- [Code Quality Standards](#code-quality-standards)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Documentation](#documentation)
- [Release Process](#release-process)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to [vaporjawn@gmail.com](mailto:vaporjawn@gmail.com).

### Our Pledge

We pledge to make participation in our project and community a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0 (or **yarn** >= 1.22.0, **pnpm** >= 7.0.0)
- **Git** >= 2.0.0

### Quick Start

1. **Fork the repository**
2. **Clone your fork**:
   ```bash
   git clone https://github.com/vaporjawn/env-audit.git
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Make your changes and test them**
6. **Submit a pull request**

## 🛠️ Development Setup

### Environment Setup

1. **Install Node.js** using [nvm](https://github.com/nvm-sh/nvm) (recommended):
   ```bash
   nvm install 18
   nvm use 18
   ```

2. **Clone and setup the project**:
   ```bash
   git clone https://github.com/yourusername/envaudit.git
   cd envaudit
   npm install
   ```

3. **Verify setup**:
   ```bash
   npm run build
   npm test
   ```

### Development Commands

```bash
# Build the project
npm run build

# Run in development mode with watch
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Lint the code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Type check
npm run typecheck

# Clean build artifacts
npm run clean
```

### IDE Setup

We recommend using **Visual Studio Code** with the following extensions:

- **TypeScript and JavaScript Language Features** (built-in)
- **ESLint** (`dbaeumer.vscode-eslint`)
- **Prettier** (`esbenp.prettier-vscode`)
- **Vitest** (`ZixuanChen.vitest-explorer`)

#### VS Code Settings

Create `.vscode/settings.json` in your fork:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## 🏗️ Project Structure

```
src/
├── types.ts              # TypeScript type definitions
├── utils/                 # Utility functions
│   └── index.ts
├── core/                  # Core scanning logic
│   ├── file-discovery.ts  # File discovery service
│   └── scanner.ts         # Main scanner class
├── providers/             # Source-specific providers
│   ├── ast-provider.ts    # JavaScript/TypeScript AST parsing
│   ├── dotenv-provider.ts # .env file parsing
│   ├── yaml-provider.ts   # YAML file parsing (Docker, GHA)
│   └── shell-provider.ts  # Shell script parsing
├── output/                # Output generators
│   └── writers.ts         # All output writers
├── cli.ts                 # Command-line interface
└── index.ts              # Main entry point

tests/
├── integration.test.ts    # End-to-end tests
├── providers.test.ts      # Provider unit tests
├── utils.test.ts         # Utility function tests
├── writers.test.ts       # Output writer tests
└── cli.test.ts           # CLI integration tests
```

### Architecture Principles

1. **Provider Pattern**: Each source type (AST, dotenv, YAML, shell) is handled by a dedicated provider
2. **Type Safety**: Comprehensive TypeScript types ensure reliability
3. **Separation of Concerns**: Clear boundaries between discovery, scanning, and output generation
4. **Testability**: Each component is independently testable
5. **Extensibility**: Easy to add new providers and output formats

## 🔄 Development Workflow

### Branch Naming Convention

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test improvements
- `chore/description` - Maintenance tasks

### Commit Message Format

We follow the [Conventional Commits](https://conventionalcommits.org/) specification:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(providers): add shell script provider for environment variable detection

fix(cli): handle directory not found error gracefully

docs(readme): add examples for custom providers

test(integration): add tests for Docker Compose parsing
```

### Development Process

1. **Create an issue** before starting work (for features and significant changes)
2. **Assign yourself** to the issue
3. **Create a feature branch** from `main`
4. **Make small, focused commits** with clear messages
5. **Add tests** for new functionality
6. **Update documentation** as needed
7. **Run the full test suite** before submitting
8. **Submit a pull request** with a clear description

## 🧪 Testing Guidelines

### Testing Philosophy

- **Comprehensive Coverage**: Aim for 95%+ test coverage
- **Test-Driven Development**: Write tests before or alongside implementation
- **Unit Tests**: Test individual functions and classes in isolation
- **Integration Tests**: Test complete workflows and system interactions
- **Error Cases**: Test error conditions and edge cases

### Test Structure

```typescript
describe('Component Name', () => {
  // Setup and teardown
  beforeEach(() => {
    // Setup code
  });

  afterEach(() => {
    // Cleanup code
  });

  describe('method name', () => {
    it('should handle normal case', () => {
      // Test implementation
    });

    it('should handle edge case', () => {
      // Edge case test
    });

    it('should throw error for invalid input', () => {
      // Error case test
    });
  });
});
```

### Writing Tests

#### Unit Tests

Test individual functions and classes:

```typescript
import { describe, it, expect } from 'vitest';
import { createFinding } from '@/utils';

describe('createFinding', () => {
  it('should create a finding with required properties', () => {
    const finding = createFinding('TEST_VAR', 'ast', []);

    expect(finding.name).toBe('TEST_VAR');
    expect(finding.source).toBe('ast');
    expect(finding.files).toEqual([]);
  });
});
```

#### Integration Tests

Test complete workflows:

```typescript
import { describe, it, expect } from 'vitest';
import { Scanner } from '@/core/scanner';

describe('Scanner Integration', () => {
  it('should scan a TypeScript project correctly', async () => {
    const scanner = new Scanner();
    const result = await scanner.scan('./test-fixtures/typescript-project');

    expect(result.findings).toHaveLength(3);
    expect(result.framework).toBe('nextjs');
  });
});
```

#### Mock Usage

Use mocks sparingly and only when necessary:

```typescript
import { vi } from 'vitest';

const mockReadFile = vi.fn();
vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile
}));
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- providers.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests for a specific pattern
npm test -- --grep "AST Provider"
```

## ✅ Code Quality Standards

### TypeScript Guidelines

1. **Strict Mode**: All TypeScript strict mode options are enabled
2. **Type Safety**: Avoid `any` type; use proper type definitions
3. **Interfaces**: Prefer interfaces over type aliases for object types
4. **Generics**: Use generics for reusable code
5. **Optional Properties**: Use `?` for optional properties

**Example:**
```typescript
interface FindingOptions {
  required?: boolean;
  defaultValue?: string;
  isPublic?: boolean;
}

function createFinding<T extends string>(
  name: T,
  source: SourceType,
  files: FileReference[],
  options?: FindingOptions
): Finding {
  // Implementation
}
```

### ESLint Configuration

We use comprehensive ESLint rules:

```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn"
  }
}
```

### Code Style

- **Prettier**: Automatic code formatting
- **Line Length**: Maximum 100 characters
- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Required
- **Trailing Commas**: Always

### Error Handling

1. **Use Custom Error Classes**: Create specific error types
2. **Provide Context**: Include relevant information in error messages
3. **Handle Async Errors**: Proper error handling for async operations
4. **Graceful Degradation**: Handle non-critical errors gracefully

```typescript
export class ScanError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly filePath?: string
  ) {
    super(message);
    this.name = 'ScanError';
  }
}

try {
  const result = await provider.scan(filePath, content);
  return result;
} catch (error) {
  throw new ScanError(
    `Failed to scan file: ${filePath}`,
    error,
    filePath
  );
}
```

## 🔄 Pull Request Process

### Before Submitting

1. **Create or update tests** for your changes
2. **Run the full test suite**: `npm test`
3. **Check linting**: `npm run lint`
4. **Verify types**: `npm run typecheck`
5. **Build the project**: `npm run build`
6. **Update documentation** if needed

### PR Template

When creating a pull request, please include:

```markdown
## Description
Brief description of the changes.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing
- [ ] Tests added/updated for the changes
- [ ] All existing tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows the project's style guidelines
- [ ] Self-review of the code completed
- [ ] Code is well-commented, particularly hard-to-understand areas
- [ ] Documentation updated (if applicable)
- [ ] No new warnings or errors introduced

## Related Issues
Closes #(issue number)
```

### Review Process

1. **Automated Checks**: CI/CD pipeline runs automatically
2. **Code Review**: At least one maintainer reviews the code
3. **Testing**: Reviewer tests the changes locally if needed
4. **Approval**: PR requires approval from a maintainer
5. **Merge**: Maintainer merges the PR using squash and merge

### Feedback and Iteration

- **Be Open to Feedback**: Code reviews help improve code quality
- **Ask Questions**: If feedback is unclear, ask for clarification
- **Make Requested Changes**: Address all feedback before re-requesting review
- **Keep PRs Updated**: Rebase on main if needed

## 🐛 Issue Guidelines

### Bug Reports

When reporting a bug, please include:

1. **Environment Information**:
   - Node.js version
   - npm/yarn/pnpm version
   - Operating system
   - EnvAudit version

2. **Steps to Reproduce**:
   - Clear, numbered steps
   - Sample code or repository link
   - Command line arguments used

3. **Expected Behavior**: What you expected to happen

4. **Actual Behavior**: What actually happened

5. **Additional Context**: Error messages, logs, screenshots

**Bug Report Template:**
```markdown
## Bug Description
A clear and concise description of the bug.

## Environment
- Node.js version: [e.g., 18.17.0]
- EnvAudit version: [e.g., 1.0.0]
- OS: [e.g., macOS 13.4]

## Steps to Reproduce
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

## Expected Behavior
A clear description of what you expected to happen.

## Actual Behavior
A clear description of what actually happened.

## Additional Context
Add any other context about the problem here.
```

### Feature Requests

When requesting a feature:

1. **Use Case**: Explain why this feature would be useful
2. **Proposed Solution**: Describe your preferred solution
3. **Alternatives**: Consider alternative solutions
4. **Additional Context**: Any other relevant information

### Issue Labels

We use the following labels to categorize issues:

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements or additions to documentation
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed
- `question` - Further information is requested
- `wontfix` - This will not be worked on

## 📚 Documentation

### Types of Documentation

1. **README**: Project overview and quick start
2. **API Documentation**: Detailed API reference
3. **Contributing Guide**: This document
4. **Changelog**: Record of changes between versions
5. **Examples**: Usage examples and tutorials

### Writing Guidelines

- **Clear and Concise**: Use simple, direct language
- **Code Examples**: Include working code examples
- **Structure**: Use headings and lists for organization
- **Links**: Link to relevant sections and external resources
- **Screenshots**: Use images when helpful

### Documentation Updates

- **Update with Changes**: Keep documentation in sync with code
- **Review Documentation**: Check for accuracy and clarity
- **Test Examples**: Ensure code examples work correctly

## 🚀 Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. **Update Version**: Update `package.json` version
2. **Update Changelog**: Document changes in `CHANGELOG.md`
3. **Create Tag**: Create a git tag for the release
4. **Publish**: Publish to npm registry
5. **GitHub Release**: Create a GitHub release with notes

### Changelog Format

```markdown
## [1.2.0] - 2024-01-15

### Added
- New shell script provider for environment variable detection
- Support for custom public variable prefixes

### Changed
- Improved error messages for file parsing failures
- Updated dependencies to latest versions

### Fixed
- Fixed issue with nested object destructuring in AST provider
- Resolved memory leak in file discovery service

### Security
- Fixed potential security issue with shell command injection
```

## 🤝 Community

### Getting Help

- **GitHub Issues**: For bug reports and feature requests
- **Discussions**: For questions and general discussion

### Code of Conduct

All community interactions must follow our Code of Conduct:

- **Be Respectful**: Treat everyone with respect and kindness
- **Be Inclusive**: Welcome people of all backgrounds and experience levels
- **Be Constructive**: Provide helpful feedback and suggestions
- **Be Patient**: Remember that everyone is learning

### Recognition

We recognize contributors through:

- **Contributors List**: Listed in README and releases
- **Special Thanks**: Mentioned in significant releases
- **Maintainer Status**: Active contributors may become maintainers

## 📧 Contact

- **General Questions**: [vaporjawn@gmail.com](mailto:vaporjawn@gmail.com)
- **Security Issues**: [vaporjawn@gmail.com](mailto:vaporjawn@gmail.com)
- **Maintainers**: [@vaporjawn](https://github.com/vaporjawn)

---

Thank you for contributing to EnvAudit! Your involvement helps make this project better for everyone. 🎉