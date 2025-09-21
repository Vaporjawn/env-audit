import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import type {
  Provider,
  Finding,
  ScanOptions,
  Source
} from '@/types';
import {
  ParseError
} from '@/types';
import {
  createFinding,
  createFileRef,
  isPublicVariable,
  createLogger,
  getRelativePath,
  readFileSafe,
  isValidEnvVarName
} from '@/utils';

/**
 * Provider for YAML files (Docker Compose, GitHub Actions, etc.)
 */
export class YamlProvider implements Provider {
  readonly name = 'yaml';
  readonly source: Source = 'docker'; // Default, can be overridden
  readonly extensions = ['.yml', '.yaml'] as const;

  private readonly logger = createLogger();

  async scan(files: readonly string[], options: ScanOptions): Promise<readonly Finding[]> {
    const findings: Finding[] = [];

    // Filter YAML files
    const yamlFiles = files.filter(file => this.isYamlFile(file));

    this.logger.debug(`YAML provider scanning ${yamlFiles.length} files`);

    for (const file of yamlFiles) {
      try {
        const fileFindings = await this.scanFile(file, options);
        findings.push(...fileFindings);
      } catch (error) {
        this.logger.debug(`Error scanning YAML file ${file}: ${error}`);
        // Continue with other files on errors
        continue;
      }
    }

    this.logger.info(`YAML provider found ${findings.length} environment variables`);
    return Object.freeze(findings);
  }

  private async scanFile(filePath: string, options: ScanOptions): Promise<readonly Finding[]> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseYaml(content);

      if (!parsed || typeof parsed !== 'object') {
        return [];
      }

      // Detect file type based on structure and filename
      const filename = path.basename(filePath);
      const isDockerCompose = filename.includes('docker-compose') || filename.includes('compose');
      const isGitHubActions = filePath.includes('.github/workflows');

      if (isDockerCompose) {
        return this.scanDockerCompose(parsed, filePath, options);
      } else if (isGitHubActions) {
        return this.scanGitHubActions(parsed, filePath, options);
      }

      return [];
    } catch (error) {
      return [];
    }
  }

  private detectFileType(filePath: string, parsed: any): 'docker-compose' | 'github-actions' | 'kubernetes' | 'generic' {
    const fileName = path.basename(filePath).toLowerCase();

    // Docker Compose detection
    if (
      fileName.includes('docker-compose') ||
      fileName.includes('compose') ||
      (parsed && (parsed.services || parsed.version))
    ) {
      return 'docker-compose';
    }

    // GitHub Actions detection
    if (
      filePath.includes('.github/workflows') ||
      (parsed && (parsed.on || parsed.jobs))
    ) {
      return 'github-actions';
    }

    // Kubernetes detection
    if (
      parsed &&
      parsed.apiVersion &&
      parsed.kind &&
      (parsed.spec || parsed.metadata)
    ) {
      return 'kubernetes';
    }

    return 'generic';
  }

  private scanDockerCompose(parsed: any, filePath: string, options: ScanOptions): readonly Finding[] {
    const findings: Finding[] = [];

    if (!parsed || typeof parsed !== 'object') {
      return [];
    }

    // Scan services
    if (parsed.services && typeof parsed.services === 'object') {
      for (const [serviceName, service] of Object.entries(parsed.services)) {
        if (service && typeof service === 'object') {
          const serviceFindings = this.scanDockerService(
            service as any,
            serviceName,
            filePath,
            options
          );
          findings.push(...serviceFindings);
        }
      }
    }

    return Object.freeze(findings);
  }

  private scanDockerService(
    service: any,
    serviceName: string,
    filePath: string,
    options: ScanOptions
  ): Finding[] {
    const findings: Finding[] = [];
    const publicPrefixes = options.publicPrefixes ?? [];

    // Scan environment variables
    if (service.environment) {
      if (Array.isArray(service.environment)) {
        // Array format: ["VAR=value", "VAR2"]
        service.environment.forEach((envVar: string, index: number) => {
          const parsed = this.parseDockerEnvVar(envVar);
          if (parsed) {
            const fileRef = createFileRef(
              filePath,
              this.estimateLineNumber(filePath, `environment`, index),
              1,
              `Service: ${serviceName}`
            );

            const finding = createFinding(
              parsed.name,
              'docker',
              [fileRef],
              {
                required: !parsed.hasDefault,
                ...(parsed.defaultValue ? { defaultValue: parsed.defaultValue } : {}),
                isPublic: isPublicVariable(parsed.name, publicPrefixes),
              }
            );

            findings.push(finding);
          }
        });
      } else if (typeof service.environment === 'object') {
        // Object format: { VAR: "value", VAR2: null }
        Object.entries(service.environment).forEach(([name, value], index) => {
          if (isValidEnvVarName(name)) {
            const fileRef = createFileRef(
              filePath,
              this.estimateLineNumber(filePath, name, index),
              1,
              `Service: ${serviceName}`
            );

            const finding = createFinding(
              name,
              'docker',
              [fileRef],
              {
                required: value === null || value === undefined,
                ...(value && typeof value === 'string' ? { defaultValue: value } : {}),
                isPublic: isPublicVariable(name, publicPrefixes),
              }
            );

            findings.push(finding);
          }
        });
      }
    }

    // Scan env_file references
    if (service.env_file) {
      const envFiles = Array.isArray(service.env_file) ? service.env_file : [service.env_file];
      envFiles.forEach((envFile: string) => {
        // Note: We don't scan the referenced files here as they should be
        // picked up by the dotenv provider if they're included in the scan
        this.logger.debug(`Found env_file reference: ${envFile} in service ${serviceName}`);
      });
    }

    return findings;
  }

  private scanGitHubActions(parsed: any, filePath: string, options: ScanOptions): readonly Finding[] {
    const findings: Finding[] = [];

    if (!parsed || typeof parsed !== 'object') {
      return [];
    }

    const publicPrefixes = options.publicPrefixes ?? [];

    // Scan job environment variables
    if (parsed.jobs && typeof parsed.jobs === 'object') {
      for (const [jobName, job] of Object.entries(parsed.jobs)) {
        if (job && typeof job === 'object') {
          const jobFindings = this.scanGitHubJob(
            job as any,
            jobName,
            filePath,
            options
          );
          findings.push(...jobFindings);
        }
      }
    }

    // Scan workflow-level environment variables
    if (parsed.env && typeof parsed.env === 'object') {
      Object.entries(parsed.env).forEach(([name, value], index) => {
        if (isValidEnvVarName(name)) {
          const fileRef = createFileRef(
            filePath,
            this.estimateLineNumber(filePath, name, index),
            1,
            'Workflow environment'
          );

          const finding = createFinding(
            name,
            'gha',
            [fileRef],
            {
              required: false, // Workflow env vars are typically optional
              ...(value && typeof value === 'string' ? { defaultValue: value } : {}),
              isPublic: isPublicVariable(name, publicPrefixes),
            }
          );

          findings.push(finding);
        }
      });
    }

    return Object.freeze(findings);
  }

  private scanGitHubJob(
    job: any,
    jobName: string,
    filePath: string,
    options: ScanOptions
  ): Finding[] {
    const findings: Finding[] = [];
    const publicPrefixes = options.publicPrefixes ?? [];

    // Scan job environment variables
    if (job.env && typeof job.env === 'object') {
      Object.entries(job.env).forEach(([name, value], index) => {
        if (isValidEnvVarName(name)) {
          const fileRef = createFileRef(
            filePath,
            this.estimateLineNumber(filePath, name, index),
            1,
            `Job: ${jobName}`
          );

          const finding = createFinding(
            name,
            'gha',
            [fileRef],
            {
              required: false,
              ...(value && typeof value === 'string' ? { defaultValue: value } : {}),
              isPublic: isPublicVariable(name, publicPrefixes),
            }
          );

          findings.push(finding);
        }
      });
    }

    // Scan step environment variables
    if (job.steps && Array.isArray(job.steps)) {
      job.steps.forEach((step: any, stepIndex: number) => {
        if (step && step.env && typeof step.env === 'object') {
          Object.entries(step.env).forEach(([name, value], envIndex) => {
            if (isValidEnvVarName(name)) {
              const fileRef = createFileRef(
                filePath,
                this.estimateLineNumber(filePath, name, envIndex),
                1,
                `Job: ${jobName}, Step: ${stepIndex + 1}`
              );

              const finding = createFinding(
                name,
                'gha',
                [fileRef],
                {
                  required: false,
                  ...(value && typeof value === 'string' ? { defaultValue: value } : {}),
                  isPublic: isPublicVariable(name, publicPrefixes),
                }
              );

              findings.push(finding);
            }
          });
        }
      });
    }

    return findings;
  }

  private scanKubernetes(parsed: any, filePath: string, options: ScanOptions): readonly Finding[] {
    const findings: Finding[] = [];
    const publicPrefixes = options.publicPrefixes ?? [];

    // Basic Kubernetes env var scanning
    const envVars = this.extractKubernetesEnvVars(parsed);

    envVars.forEach((envVar, index) => {
      const fileRef = createFileRef(
        filePath,
        this.estimateLineNumber(filePath, envVar.name, index),
        1,
        `Kubernetes ${parsed.kind}`
      );

      const finding = createFinding(
        envVar.name,
        'docker', // Kubernetes uses docker-like env vars
        [fileRef],
        {
          required: !envVar.hasDefault,
          ...(envVar.defaultValue ? { defaultValue: envVar.defaultValue } : {}),
          isPublic: isPublicVariable(envVar.name, publicPrefixes),
        }
      );

      findings.push(finding);
    });

    return Object.freeze(findings);
  }

  private scanGenericYaml(parsed: any, filePath: string, options: ScanOptions): readonly Finding[] {
    // For generic YAML files, do a simple recursive scan for env-like patterns
    const findings: Finding[] = [];
    const publicPrefixes = options.publicPrefixes ?? [];

    const envVars = this.extractGenericEnvVars(parsed);

    envVars.forEach((envVar, index) => {
      const fileRef = createFileRef(
        filePath,
        this.estimateLineNumber(filePath, envVar.name, index),
        1,
        'Generic YAML'
      );

      const finding = createFinding(
        envVar.name,
        'docker', // Default to docker source for YAML
        [fileRef],
        {
          required: !envVar.hasDefault,
          ...(envVar.defaultValue ? { defaultValue: envVar.defaultValue } : {}),
          isPublic: isPublicVariable(envVar.name, publicPrefixes),
        }
      );

      findings.push(finding);
    });

    return Object.freeze(findings);
  }

  private parseDockerEnvVar(envVar: string): { name: string; defaultValue?: string; hasDefault: boolean } | null {
    const match = envVar.match(/^([A-Za-z_][A-Za-z0-9_]*)(=(.*))?$/);
    if (!match) {
      return null;
    }

    const [, name, , value] = match;

    if (!name || !isValidEnvVarName(name)) {
      return null;
    }

    const result: {
      name: string;
      defaultValue?: string;
      hasDefault: boolean;
    } = {
      name,
      hasDefault: Boolean(value),
    };

    if (value) {
      result.defaultValue = value;
    }

    return result;
  }

  private extractKubernetesEnvVars(obj: any): Array<{ name: string; defaultValue?: string; hasDefault: boolean }> {
    // This is a simplified implementation
    // In a real implementation, you'd want to handle all Kubernetes env var patterns
    const envVars: Array<{ name: string; defaultValue?: string; hasDefault: boolean }> = [];

    // Recursively search for env arrays
    const findEnvArrays = (current: any): void => {
      if (Array.isArray(current)) {
        current.forEach((item: any) => {
          if (item && typeof item === 'object' && item.name && isValidEnvVarName(item.name)) {
            const envVar: { name: string; defaultValue?: string; hasDefault: boolean } = {
              name: item.name,
              hasDefault: Boolean(item.value),
            };
            if (item.value) {
              envVar.defaultValue = item.value;
            }
            envVars.push(envVar);
          }
          findEnvArrays(item);
        });
      } else if (current && typeof current === 'object') {
        Object.values(current).forEach(findEnvArrays);
      }
    };

    findEnvArrays(obj);
    return envVars;
  }

  private extractGenericEnvVars(obj: any): Array<{ name: string; defaultValue?: string; hasDefault: boolean }> {
    const envVars: Array<{ name: string; defaultValue?: string; hasDefault: boolean }> = [];

    const searchObject = (current: any): void => {
      if (current && typeof current === 'object') {
        for (const [key, value] of Object.entries(current)) {
          // Look for keys that look like environment variables
          if (isValidEnvVarName(key) && key === key.toUpperCase()) {
            const envVar: { name: string; defaultValue?: string; hasDefault: boolean } = {
              name: key,
              hasDefault: typeof value === 'string',
            };
            if (typeof value === 'string') {
              envVar.defaultValue = value;
            }
            envVars.push(envVar);
          }

          // Recursively search nested objects
          if (typeof value === 'object') {
            searchObject(value);
          }
        }
      }
    };

    searchObject(obj);
    return envVars;
  }

  private estimateLineNumber(filePath: string, searchTerm: string, index: number): number {
    // This is a simple estimation - in a real implementation you might
    // want to parse the YAML with position information
    return Math.max(1, index + 1);
  }

  private isYamlFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.yml', '.yaml'].includes(ext);
  }
}

/**
 * Create a YAML provider instance
 */
export const createYamlProvider = (): Provider => {
  return new YamlProvider();
};