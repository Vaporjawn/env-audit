/**
 * EnvAudit - Environment Variable Scanner and Documentation Generator
 *
 * A TypeScript library for scanning codebases to find environment variables
 * and generating comprehensive documentation including .env.example files,
 * JSON schemas, and Markdown documentation.
 */

// Core functionality
export { Scanner, createScanner, scan } from '@/core/scanner';
export { DefaultFileDiscovery } from '@/core/file-discovery';

// Providers
export { AstProvider, createAstProvider } from '@/providers/ast-provider';
export { DotenvProvider, createDotenvProvider } from '@/providers/dotenv-provider';
export { YamlProvider, createYamlProvider } from '@/providers/yaml-provider';
export { ShellProvider, createShellProvider } from '@/providers/shell-provider';

// Output writers
export {
  EnvExampleWriter,
  JsonSchemaWriter,
  MarkdownWriter,
  createEnvExampleWriter,
  createJsonSchemaWriter,
  createMarkdownWriter
} from '@/output/writers';
export type { OutputWriter } from '@/output/writers';

// CLI
export { EnvAuditCLI } from '@/cli';

// Types
export type {
  // Core types
  Finding,
  FileReference,
  ScanResult,
  ScanOptions,
  ScanStats,

  // Provider types
  Provider,

  // Framework and source types
  Framework,
  Source,

  // Configuration types
  FrameworkConfig,
  LogLevel,

  // Error types
  ParseError,
  ScanError,
} from '@/types';

// Utilities
export {
  createFinding,
  createFileRef,
  mergeFindings,
  detectFramework,
  isPublicVariable,
  isValidEnvVarName,
  createLogger,
  getRelativePath,
  readFileSafe,
} from '@/utils';

// Constants
export {
  FRAMEWORK_CONFIGS,
  SUPPORTED_FRAMEWORKS,
  DEFAULT_PUBLIC_PREFIXES,
  DEFAULT_EXCLUDE_PATTERNS,
} from '@/types';