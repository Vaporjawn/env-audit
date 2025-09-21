/**
 * Source types for environment variable detection
 */
export type Source =
  | 'process'      // process.env.* (Node.js)
  | 'importmeta'   // import.meta.env.* (Vite, Astro, SvelteKit)
  | 'docker'       // Docker Compose environment variables
  | 'gha'          // GitHub Actions env/secrets
  | 'shell'        // Shell script variables ($VAR)
  | 'dotenv'       // .env files
  | 'ast';         // AST parsing results

/**
 * Log levels for controlling output verbosity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Supported framework names
 */
export type Framework = 'nextjs' | 'vite' | 'react' | 'vue' | 'svelte' | 'sveltekit' | 'nuxt' | 'astro' | 'angular' | 'remix' | 'gatsby' | 'webpack' | 'nodejs' | 'generic';

/**
 * File reference information for tracing environment variables
 */
export interface FileRef {
  /** Absolute file path */
  readonly filePath: string;
  /** Line number (1-based) */
  readonly line: number;
  /** Column number (1-based) */
  readonly column: number;
  /** Surrounding code context */
  readonly context?: string;
  /** Additional context or hint about the usage */
  readonly hint?: string;
}

/**
 * Core finding representing a discovered environment variable
 */
export interface Finding {
  /** Environment variable name */
  readonly name: string;
  /** Source type where this variable was found */
  readonly source: Source;
  /** List of file references where this variable appears */
  readonly files: readonly FileRef[];
  /** Whether this variable is required (determined by guards/assertions) */
  readonly required: boolean;
  /** Default value if found in the code */
  readonly defaultValue?: string;
  /** Whether this is a public/client-side variable */
  readonly isPublic: boolean;
  /** Additional notes or warnings */
  readonly notes?: readonly string[];
}

/**
 * Statistics about the scan operation
 */
export interface ScanStats {
  /** Total number of files analyzed */
  readonly totalFiles: number;
  /** Total number of findings */
  readonly totalFindings: number;
  /** Number of parse errors encountered */
  readonly parseErrors: number;
  /** Scan duration in milliseconds */
  readonly scanTime: number;
  /** Scan duration in milliseconds (legacy) */
  readonly durationMs: number;
  /** Files processed by each provider */
  readonly filesByProvider: Record<Source, number>;
  /** Variables found by each provider */
  readonly variablesByProvider: Record<Source, number>;
}

/**
 * Complete scan result
 */
export interface ScanResult {
  /** All discovered environment variables */
  readonly findings: readonly Finding[];
  /** Scan operation statistics */
  readonly stats: ScanStats;
  /** When the scan was performed */
  readonly scannedAt: string;
  /** Detected framework */
  readonly framework?: Framework;
}

/**
 * Framework detection patterns and configurations
 */
export const SUPPORTED_FRAMEWORKS: readonly Framework[] = [
  'nextjs',
  'react',
  'vue',
  'nuxt',
  'angular',
  'svelte',
  'sveltekit',
  'astro',
  'remix',
  'gatsby',
  'vite',
  'webpack',
  'nodejs',
] as const;

/**
 * Default public prefixes for environment variables
 */
export const DEFAULT_PUBLIC_PREFIXES: readonly string[] = [
  'NEXT_PUBLIC_',
  'VITE_',
  'REACT_APP_',
  'VUE_APP_',
  'NUXT_PUBLIC_',
  'PUBLIC_',
] as const;

/**
 * Default patterns to exclude from scanning
 */
export const DEFAULT_EXCLUDE_PATTERNS: readonly string[] = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/vendor/**',
  '**/.env.local',
  '**/.env.*.local',
] as const;

/**
 * File reference with metadata
 */
export interface FileReference {
  /** Absolute file path */
  readonly path: string;
  /** File size in bytes */
  readonly size: number;
  /** Last modification time */
  readonly mtime: Date;
  /** File type/extension */
  readonly type: string;
  /** Whether file is binary */
  readonly isBinary: boolean;
}

/**
 * Scan error details
 */
export interface ScanError {
  /** Error message */
  readonly message: string;
  /** Error code */
  readonly code: string;
  /** File path where error occurred */
  readonly file?: string;
  /** Line number where error occurred */
  readonly line?: number;
  /** Column number where error occurred */
  readonly column?: number;
  /** Stack trace */
  readonly stack?: string;
}

/**
 * Framework-specific patterns and validation rules
 */
export interface FrameworkConfig {
  /** Framework name */
  readonly name: string;
  /** Public variable prefixes (e.g., 'VITE_', 'NEXT_PUBLIC_') */
  readonly publicPrefixes: readonly string[];
  /** Framework-specific file patterns to include */
  readonly includePatterns?: readonly string[];
  /** Framework-specific file patterns to exclude */
  readonly excludePatterns?: readonly string[];
  /** Framework-specific variable detection patterns */
  readonly patterns?: readonly string[];
}

/**
 * Scan configuration options
 */
export interface ScanOptions {
  /** Root directory to scan (default: current working directory) */
  readonly dir?: string;
  /** File patterns to include (glob patterns) */
  readonly include?: readonly string[];
  /** File patterns to exclude (glob patterns) */
  readonly exclude?: readonly string[];
  /** Framework configuration (auto-detected if not specified) */
  readonly framework?: string | FrameworkConfig;
  /** Additional public prefixes to detect */
  readonly publicPrefixes?: readonly string[];
  /** Maximum file size to parse (in bytes) */
  readonly maxFileSize?: number;
  /** Whether to follow symbolic links */
  readonly followSymlinks?: boolean;
  /** Custom cache directory */
  readonly cacheDir?: string;
  /** Whether to use caching */
  readonly cache?: boolean;
  /** Whether to respect .gitignore */
  readonly respectGitignore?: boolean;
  /** Debug mode */
  readonly debug?: boolean;
  /** Only include these providers (if specified) */
  readonly includeProviders?: readonly string[];
  /** Exclude these providers */
  readonly excludeProviders?: readonly string[];
}

/**
 * CLI-specific options extending ScanOptions
 */
export interface CliOptions extends ScanOptions {
  /** Output formats to generate */
  readonly format?: readonly OutputFormat[];
  /** Output file for .env.example */
  readonly outEnv?: string;
  /** Output file for JSON schema */
  readonly outJson?: string;
  /** Output file for Markdown documentation */
  readonly outMd?: string;
  /** CI mode - fail on differences */
  readonly ci?: boolean;
  /** Fail if output files would change */
  readonly failOnDiff?: boolean;
  /** Only print to console, don't write files */
  readonly dryRun?: boolean;
  /** Verbose output */
  readonly verbose?: boolean;
  /** Silent mode */
  readonly silent?: boolean;
}

/**
 * Output format types
 */
export type OutputFormat = 'env' | 'json' | 'md' | 'yaml';

/**
 * Provider interface for scanning different file types
 */
export interface Provider {
  /** Provider name */
  readonly name: string;
  /** Source type this provider handles */
  readonly source: Source;
  /** File extensions this provider can handle */
  readonly extensions: readonly string[];
  /** Scan files and return findings */
  scan(files: readonly string[], options: ScanOptions): Promise<readonly Finding[]>;
}

/**
 * Cache entry for file scanning results
 */
export interface CacheEntry {
  /** File path */
  readonly path: string;
  /** File modification time */
  readonly mtime: number;
  /** File size in bytes */
  readonly size: number;
  /** File content hash */
  readonly hash: string;
  /** Cached findings */
  readonly findings: readonly Finding[];
  /** Cache timestamp */
  readonly timestamp: number;
}

/**
 * Configuration file structure (.env-audit.json)
 */
export interface ConfigFile {
  /** Base scan options */
  readonly scan?: Partial<ScanOptions>;
  /** Output configuration */
  readonly output?: {
    readonly formats?: readonly OutputFormat[];
    readonly envFile?: string;
    readonly jsonFile?: string;
    readonly mdFile?: string;
  };
  /** Framework overrides */
  readonly frameworks?: Record<string, FrameworkConfig>;
  /** Custom public prefixes */
  readonly publicPrefixes?: readonly string[];
  /** Provider-specific configuration */
  readonly providers?: Record<string, unknown>;
}

/**
 * Output writer interface
 */
export interface OutputWriter {
  /** Output format name */
  readonly format: OutputFormat;
  /** Write findings to specified path */
  write(findings: readonly Finding[], outputPath: string, options: CliOptions): Promise<void>;
  /** Generate content as string */
  generate(findings: readonly Finding[], options: CliOptions): Promise<string>;
}

/**
 * Error types for better error handling
 */
export class EnvAuditError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'EnvAuditError';
  }
}

export class ParseError extends EnvAuditError {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly line?: number,
    public readonly column?: number
  ) {
    super(message, 'PARSE_ERROR', { filePath, line, column });
    this.name = 'ParseError';
  }
}

export class FileSystemError extends EnvAuditError {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly path: string
  ) {
    super(message, 'FILESYSTEM_ERROR', { operation, path });
    this.name = 'FileSystemError';
  }
}

export class ConfigurationError extends EnvAuditError {
  constructor(message: string, public readonly option?: string) {
    super(message, 'CONFIGURATION_ERROR', { option });
    this.name = 'ConfigurationError';
  }
}

/**
 * AST Node types for environment variable detection
 */
export interface EnvVarNode {
  /** Variable name */
  readonly name: string;
  /** Source type */
  readonly source: Source;
  /** Location in file */
  readonly location: {
    readonly start: { readonly line: number; readonly column: number };
    readonly end: { readonly line: number; readonly column: number };
  };
  /** Whether this appears to be required (has guards) */
  readonly hasGuards: boolean;
  /** Default value if present */
  readonly defaultValue?: string;
  /** Context around the usage */
  readonly context?: string;
}

/**
 * Built-in framework configurations
 */
export const FRAMEWORK_CONFIGS: Record<string, FrameworkConfig> = {
  nextjs: {
    name: 'Next.js',
    publicPrefixes: ['NEXT_PUBLIC_'],
    includePatterns: ['**/*.{js,jsx,ts,tsx}', '**/next.config.*'],
    excludePatterns: ['**/.next/**'],
  },
  vite: {
    name: 'Vite',
    publicPrefixes: ['VITE_'],
    includePatterns: ['**/*.{js,jsx,ts,tsx,vue}', '**/vite.config.*'],
    excludePatterns: ['**/dist/**'],
  },
  astro: {
    name: 'Astro',
    publicPrefixes: ['PUBLIC_'],
    includePatterns: ['**/*.{js,jsx,ts,tsx,astro}', '**/astro.config.*'],
    excludePatterns: ['**/dist/**'],
  },
  sveltekit: {
    name: 'SvelteKit',
    publicPrefixes: ['PUBLIC_'],
    includePatterns: ['**/*.{js,ts,svelte}', '**/svelte.config.*'],
    excludePatterns: ['**/.svelte-kit/**'],
  },
  nuxt: {
    name: 'Nuxt',
    publicPrefixes: ['NUXT_PUBLIC_'],
    includePatterns: ['**/*.{js,ts,vue}', '**/nuxt.config.*'],
    excludePatterns: ['**/.nuxt/**', '**/dist/**'],
  },
  remix: {
    name: 'Remix',
    publicPrefixes: [],
    includePatterns: ['**/*.{js,jsx,ts,tsx}', '**/remix.config.*'],
    excludePatterns: ['**/build/**'],
  },
} as const;

/**
 * Default scan options
 */
export const DEFAULT_SCAN_OPTIONS: Required<Omit<ScanOptions, 'dir' | 'framework'>> = {
  include: [
    '**/*.{js,jsx,ts,tsx,mjs,cjs}',
    '**/*.{yml,yaml}',
    '**/*.{sh,bash,zsh}',
    '.env*',
    'package.json',
  ],
  exclude: [
    '**/node_modules/**',
    '.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/.nuxt/**',
    '**/.svelte-kit/**',
    '**/coverage/**',
    '**/*.d.ts',
  ],
  publicPrefixes: DEFAULT_PUBLIC_PREFIXES,
  maxFileSize: 1024 * 1024, // 1MB
  followSymlinks: false,
  cacheDir: '.env-audit-cache',
  cache: true,
  respectGitignore: true,
  debug: false,
  includeProviders: [],
  excludeProviders: [],
} as const;

/**
 * Default CLI options
 */
export const DEFAULT_CLI_OPTIONS: Partial<CliOptions> = {
  format: ['env', 'json'],
  outEnv: '.env.example',
  outJson: 'env.schema.json',
  outMd: 'ENVIRONMENT.md',
  ci: false,
  failOnDiff: false,
  dryRun: false,
  verbose: false,
  silent: false,
} as const;

/**
 * Type guards for runtime type checking
 */
export const isValidSource = (value: unknown): value is Source => {
  return typeof value === 'string' &&
    ['process', 'importmeta', 'docker', 'gha', 'shell', 'dotenv'].includes(value);
};

export const isValidOutputFormat = (value: unknown): value is OutputFormat => {
  return typeof value === 'string' &&
    ['env', 'json', 'md', 'yaml'].includes(value);
};

export const isFinding = (value: unknown): value is Finding => {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    isValidSource(obj.source) &&
    Array.isArray(obj.files) &&
    typeof obj.required === 'boolean' &&
    typeof obj.isPublic === 'boolean'
  );
};

/**
 * Utility types for advanced TypeScript usage
 */
export type SourceMap<T> = {
  readonly [K in Source]: T;
};

export type PartialSourceMap<T> = {
  readonly [K in Source]?: T;
};

export type FindingBySource = SourceMap<readonly Finding[]>;

export type RequiredScanOptions = Required<ScanOptions>;

export type MutableFinding = {
  -readonly [K in keyof Finding]: Finding[K] extends readonly (infer U)[]
    ? U[]
    : Finding[K];
};

/**
 * Re-export commonly used types for convenience
 */
export type {
  Finding as EnvVariable,
  ScanResult as ScanResults,
  ScanOptions as Options,
  CliOptions as CLIOptions,
};