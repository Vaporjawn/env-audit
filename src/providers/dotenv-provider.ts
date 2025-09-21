import path from 'node:path';
import type {
  Provider,
  Finding,
  ScanOptions,
  Source
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
 * Provider for .env files and similar environment files
 */
export class DotenvProvider implements Provider {
  readonly name = 'dotenv';
  readonly source: Source = 'dotenv';
  readonly extensions = ['.env'] as const;

  private readonly logger = createLogger();

  async scan(files: readonly string[], options: ScanOptions): Promise<readonly Finding[]> {
    const findings: Finding[] = [];

    // Filter files that match .env patterns
    const envFiles = files.filter(file => this.isEnvFile(file));

    this.logger.debug(`Dotenv provider scanning ${envFiles.length} files`);

    for (const file of envFiles) {
      try {
        const fileFindings = await this.scanFile(file, options);
        findings.push(...fileFindings);
      } catch (error) {
        this.logger.debug(`Error scanning env file ${file}: ${error}`);
        // Continue with other files on errors
        continue;
      }
    }

    this.logger.info(`Dotenv provider found ${findings.length} environment variables`);
    return Object.freeze(findings);
  }

  private async scanFile(filePath: string, options: ScanOptions): Promise<readonly Finding[]> {
    const content = await readFileSafe(filePath, options.maxFileSize ?? 1024 * 1024);
    if (!content) {
      this.logger.debug(`Skipping env file (empty or too large): ${filePath}`);
      return [];
    }

    const findings: Finding[] = [];
    const lines = content.split('\n');
    const publicPrefixes = options.publicPrefixes ?? [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      const lineNumber = i + 1;

      // Skip empty lines and comments
      if (!line || line.startsWith('#')) {
        continue;
      }

      const envVar = this.parseEnvLine(line, lineNumber);
      if (envVar) {
        const fileRef = createFileRef(
          filePath,
          lineNumber,
          1, // .env files typically start variables at column 1
          envVar.comment
        );

        const finding = createFinding(
          envVar.name,
          this.source,
          [fileRef],
          {
            required: !envVar.hasDefault, // If no default value, consider it required
            ...(envVar.defaultValue ? { defaultValue: envVar.defaultValue } : {}),
            isPublic: isPublicVariable(envVar.name, publicPrefixes),
            ...(envVar.comment ? { notes: [envVar.comment] } : {}),
          }
        );

        findings.push(finding);
      }
    }

    return Object.freeze(findings);
  }

  private parseEnvLine(line: string, lineNumber: number): {
    name: string;
    defaultValue?: string;
    hasDefault: boolean;
    comment?: string;
  } | null {
    // Handle inline comments
    let workingLine = line;
    let comment: string | undefined;

    const commentIndex = line.indexOf('#');
    if (commentIndex > 0) {
      // Check if # is inside quotes
      const beforeComment = line.substring(0, commentIndex);
      const singleQuotes = (beforeComment.match(/'/g) || []).length;
      const doubleQuotes = (beforeComment.match(/"/g) || []).length;

      // If quotes are balanced, # is a comment
      if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0) {
        comment = line.substring(commentIndex + 1).trim();
        workingLine = beforeComment.trim();
      }
    }

    // Parse KEY=VALUE pattern
    const match = workingLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      return null;
    }

    const [, name, value] = match;

    if (!name) {
      return null;
    }

    if (!isValidEnvVarName(name)) {
      return null;
    }

    // Parse the value
    const parsedValue = this.parseEnvValue(value || '');

    const result: {
      name: string;
      defaultValue?: string;
      hasDefault: boolean;
      comment?: string;
    } = {
      name,
      hasDefault: parsedValue.hasValue,
    };

    if (parsedValue.value !== undefined) {
      result.defaultValue = parsedValue.value;
    }

    if (comment !== undefined) {
      result.comment = comment;
    }

    return result;
  }

  private parseEnvValue(value: string): { value?: string; hasValue: boolean } {
    if (!value) {
      return { hasValue: false };
    }

    let trimmedValue = value.trim();

    // Handle quoted values
    if (
      (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
      (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
    ) {
      trimmedValue = trimmedValue.slice(1, -1);
    }

    // Handle common placeholder patterns that indicate no real value
    const placeholders = [
      '',
      'YOUR_VALUE_HERE',
      'CHANGE_ME',
      'REPLACE_ME',
      'TODO',
      'TBD',
      '...',
      'xxx',
      'XXX',
    ];

    if (placeholders.includes(trimmedValue.toUpperCase())) {
      return { hasValue: false };
    }

    return {
      value: trimmedValue,
      hasValue: true
    };
  }

  private isEnvFile(filePath: string): boolean {
    const fileName = path.basename(filePath);

    // Common .env file patterns
    const envPatterns = [
      /^\.env$/,
      /^\.env\..+$/,
      /^env$/,
      /^environment$/,
      /.*\.env$/,
    ];

    return envPatterns.some(pattern => pattern.test(fileName));
  }
}

/**
 * Create a dotenv provider instance
 */
export const createDotenvProvider = (): Provider => {
  return new DotenvProvider();
};