# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of EnvAudit
- Complete TypeScript implementation with strict type checking
- Multi-source environment variable detection
- Framework-aware scanning with automatic detection
- Comprehensive CLI interface with scan, check, and print commands
- Multiple output formats: .env.example, JSON Schema, and Markdown
- Provider system for extensible source detection
- Comprehensive test suite with 95%+ coverage

## [1.0.0] - 2024-01-01

### Added
- **Core Features**
  - AST-based JavaScript/TypeScript environment variable detection
  - Support for `process.env` and `import.meta.env` patterns
  - Destructuring pattern recognition
  - Default value detection

- **Provider System**
  - AST Provider for JavaScript/TypeScript files
  - Dotenv Provider for .env files
  - YAML Provider for Docker Compose and GitHub Actions
  - Shell Provider for bash/zsh scripts
  - Extensible provider interface for custom implementations

- **Framework Support**
  - Automatic framework detection (Next.js, Vite, Create React App)
  - Framework-specific public variable prefixes
  - Custom configuration support

- **CLI Interface**
  - `scan` command for generating environment documentation
  - `check` command for validating environment configuration
  - `print` command for console output
  - Comprehensive option support
  - Progress indicators and error handling

- **Output Formats**
  - `.env.example` generation with comments and metadata
  - JSON Schema with validation patterns and examples
  - Markdown documentation with tables and badges
  - Customizable output directory and file naming

- **File Discovery**
  - Fast-glob based file scanning
  - Gitignore support
  - Configurable include/exclude patterns
  - Symbolic link handling
  - File size limits

- **Security Features**
  - Public vs private variable identification
  - Security-focused variable analysis
  - Safe default placeholder generation

- **Developer Experience**
  - TypeScript-first development
  - Comprehensive error messages
  - Verbose logging options
  - Configuration file support

- **Testing**
  - Integration tests for end-to-end functionality
  - Unit tests for all providers and utilities
  - CLI integration tests
  - Output writer tests
  - Mock filesystem testing

- **Documentation**
  - Comprehensive README with examples
  - API documentation for programmatic usage
  - Contributing guidelines
  - Code of conduct
  - Security policy

### Technical Details
- **Dependencies**
  - Babel ecosystem for AST parsing
  - Commander.js for CLI framework
  - fast-glob for file discovery
  - yaml for YAML parsing
  - Node.js 18+ compatibility

- **Build System**
  - tsup for TypeScript compilation
  - Dual ESM/CJS output
  - Source maps generation
  - Type declaration files

- **Code Quality**
  - ESLint with TypeScript rules
  - Prettier code formatting
  - Vitest testing framework
  - 95%+ test coverage

- **Package Configuration**
  - NPM package with proper exports
  - CLI binary registration
  - Proper peer dependencies
  - MIT license

---

## Release Process

### Version Planning
- **Major (x.0.0)**: Breaking API changes, major new features
- **Minor (x.y.0)**: New features, provider additions, CLI enhancements
- **Patch (x.y.z)**: Bug fixes, documentation updates, dependency updates

### Upcoming Features
- IDE extensions for VS Code and JetBrains
- Configuration validation in real-time
- Environment diff capabilities
- Secret detection and analysis
- Performance optimizations for large codebases
- Cloud provider integrations

### Breaking Changes Policy
We follow semantic versioning strictly:
- Breaking changes will only be introduced in major versions
- Deprecation warnings will be provided one minor version before removal
- Migration guides will be provided for all breaking changes

### Security Updates
Security updates will be released as patch versions and will be clearly marked in the changelog with a **Security** section.

---

## Contributing to Changelog

When contributing to this project:

1. **Add entries to [Unreleased]** section for new changes
2. **Use proper categories**: Added, Changed, Deprecated, Removed, Fixed, Security
3. **Write clear descriptions** that help users understand the impact
4. **Include issue/PR references** where applicable
5. **Move entries to versioned sections** during releases

### Changelog Categories

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** in case of vulnerabilities

---

*This changelog is automatically updated during the release process and manually maintained by project maintainers.*