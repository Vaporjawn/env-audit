import type {
  Provider,
  Finding,
  ScanOptions,
  ScanResult,
  Framework,
  Source
} from '@/types';
import {
  createLogger,
  mergeFindings,
  detectFramework,
  getRelativePath,
  mergeOptions
} from '@/utils';
import { DefaultFileDiscovery } from '@/core/file-discovery';
import { createAstProvider } from '@/providers/ast-provider';
import { createDotenvProvider } from '@/providers/dotenv-provider';
import { createYamlProvider } from '@/providers/yaml-provider';
import { createShellProvider } from '@/providers/shell-provider';

/**
 * Core scanner that orchestrates all providers to scan a codebase
 */
export class Scanner {
  private readonly logger = createLogger();
  private readonly fileDiscovery = new DefaultFileDiscovery();
  private readonly providers: Map<string, Provider> = new Map();

  constructor() {
    this.registerDefaultProviders();
  }

  /**
   * Register default providers
   */
  private registerDefaultProviders(): void {
    this.registerProvider(createAstProvider());
    this.registerProvider(createDotenvProvider());
    this.registerProvider(createYamlProvider());
    this.registerProvider(createShellProvider());

    this.logger.debug(`Registered ${this.providers.size} providers`);
  }

  /**
   * Register a provider
   */
  registerProvider(provider: Provider): void {
    this.providers.set(provider.name, provider);
    this.logger.debug(`Registered provider: ${provider.name}`);
  }

  /**
   * Get registered provider names
   */
  getProviderNames(): readonly string[] {
    return Object.freeze([...this.providers.keys()]);
  }

  /**
   * Scan a directory or files for environment variables
   */
  async scan(
    path: string | readonly string[],
    options: Partial<ScanOptions> = {}
  ): Promise<ScanResult> {
    const startTime = Date.now();
    this.logger.info(`Starting scan of: ${Array.isArray(path) ? path.join(', ') : path}`);

    // Normalize options with defaults
    const scanOptions = this.normalizeOptions(options);

    try {
      // Discover files
      this.logger.info(`Calling discoverFiles with options: ${JSON.stringify(scanOptions, null, 2)}`);
      const files = await this.discoverFiles(path, scanOptions);
      this.logger.info(`Discovered ${files.length} files to scan`);
      this.logger.info(`Discovered files: ${JSON.stringify(files.slice(0, 10))}`);

      // Detect framework if not specified
      const framework = scanOptions.framework ?? await this.detectFramework(files, scanOptions);
      this.logger.info(`Framework detection result: ${framework}`);
      const finalOptions = {
        ...scanOptions,
        ...(framework && { framework })
      };

      // Run providers
      const findings = await this.runProviders(files, finalOptions);

      // Merge and deduplicate findings
      const mergedFindings = this.mergeAndDeduplicateFindings(findings);

      // Calculate statistics
      const totalFiles = files.length;
      const parseErrors = 0; // TODO: Track parse errors from providers
      const findingsBySource = this.groupFindingsBySource(mergedFindings);

      // Create result
      const resultBase = {
        findings: mergedFindings,
        scannedAt: new Date().toISOString(),
        stats: {
          totalFiles: totalFiles,
          totalFindings: mergedFindings.length,
          parseErrors: parseErrors,
          scanTime: Date.now() - startTime,
          durationMs: Date.now() - startTime,
          filesByProvider: {
            process: 0,
            importmeta: 0,
            dotenv: 0,
            docker: 0,
            gha: 0,
            shell: 0,
            ast: 0,
          },
          variablesByProvider: findingsBySource,
        },
      };

      // Add framework property conditionally for exactOptionalPropertyTypes compatibility
      const result: ScanResult = framework
        ? { ...resultBase, framework: framework as Framework }
        : resultBase;

      this.logger.info(
        `Scan completed: ${mergedFindings.length} findings from ${totalFiles} files in ${Date.now() - startTime}ms`
      );

      return result;
    } catch (error) {
      this.logger.error(`Scan failed: ${error}`);
      throw error;
    }
  }

  /**
   * Discover files to scan
   */
  private async discoverFiles(
    path: string | readonly string[],
    options: ScanOptions
  ): Promise<readonly string[]> {
    if (Array.isArray(path)) {
      // If given specific files, just return them
      return path;
    }

    return this.fileDiscovery.discoverFiles({ ...options, dir: path as string });
  }

  /**
   * Detect framework from files
   */
  private async detectFramework(
    files: readonly string[],
    options: ScanOptions
  ): Promise<Framework | undefined> {
    this.logger.info(`detectFramework called with ${files.length} files: ${JSON.stringify(files.slice(0, 5))}`);

    // Look for package.json or other framework indicators
    const packageJsonFiles = files.filter(file => file.endsWith('package.json'));
    this.logger.info(`Found ${packageJsonFiles.length} package.json files: ${JSON.stringify(packageJsonFiles)}`);

    if (packageJsonFiles.length > 0) {
      // Get directory from package.json file path
      const packageJsonFile = packageJsonFiles[0]!;
      const packageJsonDir = packageJsonFile.substring(0, packageJsonFile.lastIndexOf('/')) || '.';
      const frameworkKey = await detectFramework(packageJsonDir);
      if (frameworkKey) {
        this.logger.info(`Detected framework: ${frameworkKey}`);
        return frameworkKey as Framework;
      }
    }

    // Check for other framework indicators
    for (const file of files) {
      if (file.includes('next.config')) {
        this.logger.info('Detected framework: nextjs');
        return 'nextjs';
      }
      if (file.includes('vite.config')) {
        this.logger.info('Detected framework: vite');
        return 'vite';
      }
      if (file.includes('astro.config')) {
        this.logger.info('Detected framework: astro');
        return 'astro';
      }
      if (file.includes('svelte.config')) {
        this.logger.info('Detected framework: svelte');
        return 'svelte';
      }
    }

    this.logger.debug('No framework detected');
    return undefined;
  }

  /**
   * Run all providers on the discovered files
   */
  private async runProviders(
    files: readonly string[],
    options: ScanOptions
  ): Promise<Map<string, readonly Finding[]>> {
    const results = new Map<string, readonly Finding[]>();
    const enabledProviders = this.getEnabledProviders(options);

    this.logger.info(`Running ${enabledProviders.length} providers`);

    // Run providers in parallel for better performance
    const providerPromises = enabledProviders.map(async (provider) => {
      try {
        const startTime = Date.now();
        const findings = await provider.scan(files, options);
        const duration = Date.now() - startTime;

        this.logger.debug(
          `Provider ${provider.name} found ${findings.length} findings in ${duration}ms`
        );

        return [provider.name, findings] as const;
      } catch (error) {
        this.logger.error(`Provider ${provider.name} failed: ${error}`);
        return [provider.name, []] as const;
      }
    });

    const providerResults = await Promise.all(providerPromises);

    for (const [providerName, findings] of providerResults) {
      results.set(providerName, findings);
    }

    return results;
  }

  /**
   * Get enabled providers based on options
   */
  private getEnabledProviders(options: ScanOptions): Provider[] {
    let providers = [...this.providers.values()];

    // Apply includeProviders filter if specified
    if (options.includeProviders && options.includeProviders.length > 0) {
      providers = providers.filter(provider =>
        options.includeProviders!.includes(provider.name)
      );
    }

    // Apply excludeProviders filter
    if (options.excludeProviders && options.excludeProviders.length > 0) {
      providers = providers.filter(provider =>
        !options.excludeProviders!.includes(provider.name)
      );
    }

    return providers;
  }

  /**
   * Merge and deduplicate findings from all providers
   */
  private mergeAndDeduplicateFindings(
    providerResults: Map<string, readonly Finding[]>
  ): readonly Finding[] {
    const allFindings: Finding[] = [];

    // Collect all findings
    for (const findings of providerResults.values()) {
      allFindings.push(...findings);
    }

    // Group by variable name for merging
    const findingsByName = new Map<string, Finding[]>();

    for (const finding of allFindings) {
      const existing = findingsByName.get(finding.name);
      if (existing) {
        existing.push(finding);
      } else {
        findingsByName.set(finding.name, [finding]);
      }
    }

    // Merge findings for each variable
    const mergedFindings: Finding[] = [];

    for (const [name, findings] of findingsByName) {
      if (findings.length === 1) {
        mergedFindings.push(findings[0]!);
      } else {
        // Merge findings for the same variable name
        const merged = mergeFindings(findings);
        mergedFindings.push(merged);
      }
    }

    // Sort by name for consistent output
    return Object.freeze(
      mergedFindings.sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  /**
   * Group findings by source for statistics
   */
  private groupFindingsBySource(findings: readonly Finding[]): Record<Source, number> {
    const groups: Record<Source, number> = {
      process: 0,
      importmeta: 0,
      dotenv: 0,
      docker: 0,
      gha: 0,
      shell: 0,
      ast: 0,
    };

    for (const finding of findings) {
      groups[finding.source] = (groups[finding.source] || 0) + 1;
    }

    return groups;
  }

  /**
   * Group findings by provider for statistics
   */
  private groupFindingsByProvider(
    providerResults: Map<string, readonly Finding[]>
  ): Record<string, number> {
    const groups: Record<string, number> = {};

    for (const [providerName, findings] of providerResults) {
      groups[providerName] = findings.length;
    }

    return groups;
  }

  /**
   * Normalize scan options with defaults
   */
  private normalizeOptions(options: Partial<ScanOptions>): ScanOptions {
    this.logger.debug('[Scanner] Input options to normalizeOptions:', JSON.stringify(options, null, 2));
    const merged = mergeOptions({
      dir: options.dir ?? process.cwd(),
      ...options,
    });
    this.logger.debug('[Scanner] Merged options from normalizeOptions:', JSON.stringify(merged, null, 2));
    return merged;
  }
}

/**
 * Create a scanner instance
 */
export const createScanner = (): Scanner => {
  return new Scanner();
};

/**
 * Convenience function to scan a directory
 */
export const scan = async (
  path: string | readonly string[],
  options: Partial<ScanOptions> = {}
): Promise<ScanResult> => {
  const scanner = createScanner();
  return scanner.scan(path, options);
};