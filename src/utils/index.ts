import path from 'node:path';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type {
  Finding,
  Source,
  FileRef,
  FrameworkConfig,
  ScanOptions,
} from '@/types';
import {
  FRAMEWORK_CONFIGS,
  DEFAULT_SCAN_OPTIONS
} from '@/types';

/**
 * Create a deep readonly version of an object
 */
export const freeze = <T>(obj: T): Readonly<T> => Object.freeze(obj);

/**
 * Create a file reference object
 */
export const createFileRef = (
  filePath: string,
  line: number,
  column: number,
  context?: string
): FileRef => {
  const ref: FileRef = {
    filePath: path.resolve(filePath),
    line,
    column,
  };

  if (context !== undefined) {
    (ref as any).context = context;
  }

  return freeze(ref);
};

/**
 * Create a finding object
 */
export const createFinding = (
  name: string,
  source: Source,
  files: readonly FileRef[],
  options: {
    readonly required?: boolean;
    readonly defaultValue?: string;
    readonly isPublic?: boolean;
    readonly notes?: readonly string[];
  } = {}
): Finding => {
  const finding: Finding = {
    name,
    source,
    files: freeze([...files]),
    required: options.required ?? true,
    isPublic: options.isPublic ?? false,
  };

  if (options.defaultValue !== undefined) {
    (finding as any).defaultValue = options.defaultValue;
  }

  if (options.notes !== undefined) {
    (finding as any).notes = freeze([...options.notes]);
  }

  return freeze(finding);
};

/**
 * Merge multiple findings with the same name into a single finding
 */
export const mergeFindings = (findings: readonly Finding[]): Finding => {
  if (findings.length === 0) {
    throw new Error('Cannot merge empty findings array');
  }

  if (findings.length === 1) {
    return findings[0]!;
  }

  // All findings should have the same name for merging
  const firstName = findings[0]!.name;
  if (!findings.every(f => f.name === firstName)) {
    throw new Error('All findings must have the same name to merge');
  }

  // Merge file references from all findings
  const allFiles = findings.flatMap(f => f.files);
  const uniqueFiles = allFiles.filter((file, index, arr) =>
    arr.findIndex(f => f.filePath === file.filePath && f.line === file.line && f.column === file.column) === index
  );

  // Find the primary source (prefer 'ast' over others)
  const sourceOrder: Source[] = ['ast', 'process', 'importmeta', 'dotenv', 'shell', 'docker', 'gha'];
  const primarySource = sourceOrder.find(source => findings.some(f => f.source === source)) ?? findings[0]!.source;

  return createFinding(
    firstName,
    primarySource,
    uniqueFiles,
    {
      required: findings.some(f => f.required),
      ...(findings.find(f => f.defaultValue) ? {
        defaultValue: findings.find(f => f.defaultValue)?.defaultValue!
      } : {}),
      isPublic: findings.some(f => f.isPublic),
      ...(findings.some(f => f.notes?.length) ? {
        notes: findings.flatMap(f => f.notes ?? [])
      } : {}),
    }
  );
};

/**
 * Detect framework from package.json and file patterns
 */
export const detectFramework = async (rootDir: string): Promise<string | null> => {
  try {
    const packageJsonPath = path.join(rootDir, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Check for framework-specific dependencies
    if (dependencies.next) return 'nextjs';
    if (dependencies.vite) return 'vite';
    if (dependencies.astro) return 'astro';
    if (dependencies['@sveltejs/kit']) return 'sveltekit';
    if (dependencies.nuxt) return 'nuxt';
    if (dependencies['@remix-run/node'] || dependencies['@remix-run/react']) {
      return 'remix';
    }

    // Check for config files
    const configFiles = await fs.readdir(rootDir);
    if (configFiles.some((f: string) => f.startsWith('next.config'))) return 'nextjs';
    if (configFiles.some((f: string) => f.startsWith('vite.config'))) return 'vite';
    if (configFiles.some((f: string) => f.startsWith('astro.config'))) return 'astro';
    if (configFiles.some((f: string) => f.startsWith('svelte.config'))) return 'sveltekit';
    if (configFiles.some((f: string) => f.startsWith('nuxt.config'))) return 'nuxt';
    if (configFiles.some((f: string) => f.startsWith('remix.config'))) return 'remix';

    return null;
  } catch {
    return null;
  }
};

/**
 * Check if a variable name matches public prefixes
 */
export const isPublicVariable = (
  name: string,
  prefixes: readonly string[]
): boolean => {
  if (!name || typeof name !== 'string') return false;
  if (!prefixes || !Array.isArray(prefixes)) return false;

  return prefixes.some(prefix => name.startsWith(prefix));
};

/**
 * Normalize file path to use forward slashes
 */
export const normalizePath = (filePath: string): string => {
  return filePath.replace(/\\/g, '/');
};

/**
 * Get relative path from root directory
 */
export const getRelativePath = (filePath: string, rootDir: string = process.cwd()): string => {
  if (!filePath || typeof filePath !== 'string') return '';

  const relative = path.relative(rootDir, filePath);
  const normalized = normalizePath(relative);

  // Handle current directory case
  if (normalized === '') return '.';

  return normalized;
};

/**
 * Calculate file hash for caching
 */
export const calculateFileHash = async (filePath: string): Promise<string> => {
  try {
    const content = await fs.readFile(filePath);
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return '';
  }
};

/**
 * Safely parse JSON with error handling
 */
export const parseJson = <T = unknown>(content: string): T | null => {
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
};

/**
 * Format bytes to human readable string
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Format duration in milliseconds to human readable string
 */
export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};

/**
 * Create a debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Validate environment variable name
 */
export const isValidEnvVarName = (name: string): boolean => {
  if (!name || typeof name !== 'string') return false;

  // Environment variables should:
  // 1. Not be empty
  // 2. Not start with a number
  // 3. Only contain letters, numbers, and underscores
  // 4. Be uppercase by convention (but not enforced)
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
};

/**
 * Extract environment variable name from various patterns
 */
export const extractEnvVarName = (
  expression: string,
  source: Source
): string | null => {
  switch (source) {
    case 'process':
      // process.env.VAR_NAME or process.env['VAR_NAME']
      {
        const dotMatch = expression.match(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/);
        if (dotMatch && dotMatch[1]) return dotMatch[1];

        const bracketMatch = expression.match(/process\.env\[['"`]([^'"`]+)['"`]\]/);
        if (bracketMatch && bracketMatch[1]) return bracketMatch[1];
      }
      break;

    case 'importmeta':
      // import.meta.env.VAR_NAME or import.meta.env['VAR_NAME']
      {
        const dotMatch = expression.match(/import\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)/);
        if (dotMatch && dotMatch[1]) return dotMatch[1];

        const bracketMatch = expression.match(/import\.meta\.env\[['"`]([^'"`]+)['"`]\]/);
        if (bracketMatch && bracketMatch[1]) return bracketMatch[1];
      }
      break;

    case 'shell':
      // $VAR_NAME or ${VAR_NAME}
      {
        const match = expression.match(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/);
        if (match && match[1]) return match[1];
      }
      break;

    case 'dotenv':
      // VAR_NAME=value
      {
        const match = expression.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
        if (match && match[1]) return match[1];
      }
      break;
  }

  return null;
};

/**
 * Merge scan options with defaults
 */
export const mergeOptions = (options: Partial<ScanOptions> = {}): Required<ScanOptions> => {
  return {
    ...DEFAULT_SCAN_OPTIONS,
    ...options,
    dir: options.dir ?? process.cwd(),
    framework: options.framework,
    include: options.include ?? DEFAULT_SCAN_OPTIONS.include,
    exclude: options.exclude ?? DEFAULT_SCAN_OPTIONS.exclude,
    publicPrefixes: options.publicPrefixes ?? DEFAULT_SCAN_OPTIONS.publicPrefixes,
    followSymlinks: options.followSymlinks ?? DEFAULT_SCAN_OPTIONS.followSymlinks,
    maxFileSize: options.maxFileSize ?? DEFAULT_SCAN_OPTIONS.maxFileSize,
    cacheDir: options.cacheDir ?? DEFAULT_SCAN_OPTIONS.cacheDir,
    cache: options.cache ?? DEFAULT_SCAN_OPTIONS.cache,
    respectGitignore: options.respectGitignore ?? DEFAULT_SCAN_OPTIONS.respectGitignore,
    debug: options.debug ?? DEFAULT_SCAN_OPTIONS.debug,
  } as Required<ScanOptions>;
};

/**
 * Group findings by source
 */
export const groupFindingsBySource = (
  findings: readonly Finding[]
): Record<Source, readonly Finding[]> => {
  const groups: Record<string, Finding[]> = {};

  for (const finding of findings) {
    if (!groups[finding.source]) {
      groups[finding.source] = [];
    }
    groups[finding.source]!.push(finding);
  }

  // Convert to readonly and ensure all sources are present
  const result: Record<Source, readonly Finding[]> = {
    process: freeze(groups.process ?? []),
    importmeta: freeze(groups.importmeta ?? []),
    docker: freeze(groups.docker ?? []),
    gha: freeze(groups.gha ?? []),
    shell: freeze(groups.shell ?? []),
    dotenv: freeze(groups.dotenv ?? []),
    ast: freeze(groups.ast ?? []),
  };

  return freeze(result);
};

/**
 * Filter findings based on criteria
 */
export const filterFindings = (
  findings: readonly Finding[],
  criteria: {
    readonly sources?: readonly Source[];
    readonly required?: boolean;
    readonly public?: boolean;
    readonly pattern?: RegExp;
  }
): readonly Finding[] => {
  return freeze(findings.filter(finding => {
    if (criteria.sources && !criteria.sources.includes(finding.source)) {
      return false;
    }

    if (criteria.required !== undefined && finding.required !== criteria.required) {
      return false;
    }

    if (criteria.public !== undefined && finding.isPublic !== criteria.public) {
      return false;
    }

    if (criteria.pattern && !criteria.pattern.test(finding.name)) {
      return false;
    }

    return true;
  }));
};

/**
 * Sort findings by name, source, or required status
 */
export const sortFindings = (
  findings: readonly Finding[],
  by: 'name' | 'source' | 'required' = 'name'
): readonly Finding[] => {
  const sorted = [...findings].sort((a, b) => {
    switch (by) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'source':
        return a.source.localeCompare(b.source) || a.name.localeCompare(b.name);
      case 'required':
        if (a.required !== b.required) {
          return a.required ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  return freeze(sorted);
};

/**
 * Escape string for use in regular expressions
 */
export const escapeRegex = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Create a logger with different levels
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export const createLogger = (
  options: {
    readonly debug?: boolean;
    readonly silent?: boolean;
  } = {}
): Logger => {
  const { debug = false, silent = false } = options;

  return {
    debug(message: string, ...args: unknown[]) {
      if (!silent && debug) {
        console.debug(`[DEBUG] ${message}`, ...args);
      }
    },
    info(message: string, ...args: unknown[]) {
      if (!silent) {
        console.info(`[INFO] ${message}`, ...args);
      }
    },
    warn(message: string, ...args: unknown[]) {
      if (!silent) {
        console.warn(`[WARN] ${message}`, ...args);
      }
    },
    error(message: string, ...args: unknown[]) {
      if (!silent) {
        console.error(`[ERROR] ${message}`, ...args);
      }
    },
  };
};

/**
 * Ensure directory exists
 */
export const ensureDir = async (dirPath: string): Promise<void> => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
};

/**
 * Check if file exists
 */
export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get file stats safely
 */
export const getFileStats = async (filePath: string) => {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
};

/**
 * Read file safely with size limit
 */
export const readFileSafe = async (
  filePath: string,
  maxSize: number = 1024 * 1024
): Promise<string | null> => {
  try {
    const stats = await fs.stat(filePath);
    if (stats.size > maxSize) {
      return null;
    }
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
};

/**
 * Unique array utility
 */
export const unique = <T>(array: readonly T[]): readonly T[] => {
  return freeze([...new Set(array)]);
};

/**
 * Chunk array into smaller arrays
 */
export const chunk = <T>(array: readonly T[], size: number): readonly (readonly T[])[] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return freeze(chunks.map(c => freeze(c)));
};