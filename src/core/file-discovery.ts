import path from 'node:path';
import { promises as fs } from 'node:fs';
import fastGlob from 'fast-glob';
import { minimatch } from 'minimatch';

const { glob, isDynamicPattern } = fastGlob;
import type {
  ScanOptions,
  FrameworkConfig
} from '@/types';
import {
  FileSystemError,
  FRAMEWORK_CONFIGS
} from '@/types';
import {
  detectFramework,
  mergeOptions,
  normalizePath,
  getRelativePath,
  createLogger,
  fileExists,
  readFileSafe
} from '@/utils';

/**
 * File discovery service for finding files to scan
 */
export interface FileDiscovery {
  /**
   * Discover files based on scan options
   */
  discoverFiles(options: ScanOptions): Promise<readonly string[]>;

  /**
   * Get framework configuration
   */
  getFrameworkConfig(options: ScanOptions): Promise<FrameworkConfig | null>;

  /**
   * Check if file should be included based on patterns
   */
  shouldIncludeFile(filePath: string, options: ScanOptions): boolean;
}

/**
 * Default file discovery implementation
 */
export class DefaultFileDiscovery implements FileDiscovery {
  private readonly logger = createLogger();

  async discoverFiles(options: ScanOptions): Promise<readonly string[]> {
    const mergedOptions = mergeOptions(options);
    const { dir, include, exclude, respectGitignore, followSymlinks, maxFileSize } = mergedOptions;

    try {
      // Resolve directory
      const resolvedDir = path.resolve(dir);

      // Check if directory exists
      if (!await fileExists(resolvedDir)) {
        throw new FileSystemError(
          `Directory does not exist: ${resolvedDir}`,
          'read',
          resolvedDir
        );
      }

      // Get framework config to merge patterns
      const framework = await this.getFrameworkConfig(mergedOptions);
      const allIncludePatterns = this.mergePatterns(include, framework?.includePatterns);
      const allExcludePatterns = this.mergePatterns(exclude, framework?.excludePatterns);

      this.logger.debug(`Scanning directory: ${resolvedDir}`);
      this.logger.debug(`Include patterns: ${JSON.stringify(allIncludePatterns)}`);
      this.logger.debug(`Exclude patterns: ${JSON.stringify(allExcludePatterns)}`);

      // Use fast-glob to find files
      const files = await glob([...allIncludePatterns], {
        cwd: resolvedDir,
        ignore: [...allExcludePatterns],
        absolute: true,
        followSymbolicLinks: followSymlinks,
        suppressErrors: true,
        onlyFiles: true,
        dot: true, // Include hidden directories like .github
      });

      // Filter by file size if specified
      const filteredFiles: string[] = [];
      for (const file of files) {
        try {
          const stats = await fs.stat(file);
          if (stats.size <= maxFileSize) {
            filteredFiles.push(file);
          } else {
            this.logger.debug(`Skipping large file: ${getRelativePath(file, resolvedDir)} (${stats.size} bytes)`);
          }
        } catch (error) {
          this.logger.debug(`Error reading file stats for ${file}: ${error}`);
        }
      }

      const sortedFiles = filteredFiles.sort();
      this.logger.info(`Found ${sortedFiles.length} files to scan`);

      return Object.freeze(sortedFiles);
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }

      throw new FileSystemError(
        `Failed to discover files in directory: ${dir}`,
        'scan',
        dir
      );
    }
  }

  async getFrameworkConfig(options: ScanOptions): Promise<FrameworkConfig | null> {
    const { dir, framework } = mergeOptions(options);

    // If framework is explicitly specified
    if (typeof framework === 'string') {
      // Import framework configs from types
      const { FRAMEWORK_CONFIGS } = await import('@/types');
      return FRAMEWORK_CONFIGS[framework] ?? null;
    }

    if (typeof framework === 'object') {
      return framework;
    }

    // Auto-detect framework
    try {
      const frameworkKey = await detectFramework(dir);
      return frameworkKey ? FRAMEWORK_CONFIGS[frameworkKey as keyof typeof FRAMEWORK_CONFIGS] ?? null : null;
    } catch (error) {
      this.logger.debug(`Framework detection failed: ${error}`);
      return null;
    }
  }

  shouldIncludeFile(filePath: string, options: ScanOptions): boolean {
    const mergedOptions = mergeOptions(options);
    const { include, exclude } = mergedOptions;

    const normalizedPath = normalizePath(filePath);

    // Check include patterns
    const included = include.some(pattern => {
      try {
        return isDynamicPattern(pattern)
          ? minimatch(normalizedPath, pattern)
          : normalizedPath.includes(pattern);
      } catch {
        return false;
      }
    });

    if (!included) {
      return false;
    }

    // Check exclude patterns
    const excluded = exclude.some(pattern => {
      try {
        return isDynamicPattern(pattern)
          ? minimatch(normalizedPath, pattern)
          : normalizedPath.includes(pattern);
      } catch {
        return false;
      }
    });

    return !excluded;
  }

  private mergePatterns(
    base: readonly string[],
    additional?: readonly string[]
  ): readonly string[] {
    if (!additional || additional.length === 0) {
      return base;
    }

    const merged = [...base, ...additional];
    return Object.freeze([...new Set(merged)]);
  }
}

/**
 * Create a file discovery service
 */
export const createFileDiscovery = (): FileDiscovery => {
  return new DefaultFileDiscovery();
};

/**
 * Utility function to group files by extension
 */
export const groupFilesByExtension = (
  files: readonly string[]
): Record<string, readonly string[]> => {
  const groups: Record<string, string[]> = {};

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const key = ext || 'no-extension';

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key]!.push(file);
  }

  // Convert to readonly
  const result: Record<string, readonly string[]> = {};
  for (const [key, value] of Object.entries(groups)) {
    result[key] = Object.freeze(value);
  }

  return Object.freeze(result);
};

/**
 * Utility function to filter files by pattern
 */
export const filterFilesByPattern = (
  files: readonly string[],
  pattern: string | RegExp
): readonly string[] => {
  if (typeof pattern === 'string') {
    if (isDynamicPattern(pattern)) {
      return Object.freeze(files.filter(file => minimatch(file, pattern)));
    } else {
      return Object.freeze(files.filter(file => file.includes(pattern)));
    }
  }

  return Object.freeze(files.filter(file => pattern.test(file)));
};

/**
 * Utility function to get file content safely
 */
export const getFileContent = async (
  filePath: string,
  maxSize: number = 1024 * 1024
): Promise<string | null> => {
  return await readFileSafe(filePath, maxSize);
};

/**
 * Validate scan options for file discovery
 */
export const validateScanOptions = (options: ScanOptions): string[] => {
  const errors: string[] = [];

  if (options.dir && typeof options.dir !== 'string') {
    errors.push('Directory must be a string');
  }

  if (options.include && !Array.isArray(options.include)) {
    errors.push('Include patterns must be an array');
  }

  if (options.exclude && !Array.isArray(options.exclude)) {
    errors.push('Exclude patterns must be an array');
  }

  if (options.maxFileSize && (typeof options.maxFileSize !== 'number' || options.maxFileSize <= 0)) {
    errors.push('Maximum file size must be a positive number');
  }

  return errors;
};

/**
 * Check if directory has common framework indicators
 */
export const detectFrameworkIndicators = async (dir: string): Promise<{
  readonly hasPackageJson: boolean;
  readonly hasNodeModules: boolean;
  readonly configFiles: readonly string[];
  readonly frameworkFiles: readonly string[];
}> => {
  try {
    const resolvedDir = path.resolve(dir);
    const entries = await fs.readdir(resolvedDir);

    const configFiles = entries.filter(file =>
      file.includes('.config.') ||
      file.endsWith('.config.js') ||
      file.endsWith('.config.ts') ||
      file.endsWith('.config.mjs')
    );

    const frameworkFiles = entries.filter(file =>
      ['next.config', 'vite.config', 'astro.config', 'svelte.config', 'nuxt.config', 'remix.config']
        .some(prefix => file.startsWith(prefix))
    );

    return Object.freeze({
      hasPackageJson: entries.includes('package.json'),
      hasNodeModules: entries.includes('node_modules'),
      configFiles: Object.freeze(configFiles),
      frameworkFiles: Object.freeze(frameworkFiles),
    });
  } catch {
    return Object.freeze({
      hasPackageJson: false,
      hasNodeModules: false,
      configFiles: Object.freeze([]),
      frameworkFiles: Object.freeze([]),
    });
  }
};