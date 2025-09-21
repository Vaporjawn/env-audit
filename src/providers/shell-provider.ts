import path from 'node:path';
import type {
  Provider,
  Finding,
  ScanOptions
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
 * Provider for shell scripts (.sh, .bash, .zsh, etc.)
 */
export class ShellProvider implements Provider {
  readonly name = 'shell';
  readonly source = 'shell' as const;
  readonly extensions = ['.sh', '.bash', '.zsh', '.fish'] as const;

  private readonly logger = createLogger();

  // Patterns for detecting environment variable usage
  private readonly patterns = {
    // Variable references: $VAR, ${VAR}, ${VAR:-default}
    varRef: /\$(?:\{([A-Za-z_][A-Za-z0-9_]*(?::-[^}]*)?)\}|([A-Za-z_][A-Za-z0-9_]*))/g,
    // Variable assignments: VAR=value, export VAR=value
    varAssign: /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/,
    // Variable declarations: declare VAR, local VAR
    varDeclare: /^(?:declare|local|readonly)\s+(?:-[a-zA-Z]+\s+)?([A-Za-z_][A-Za-z0-9_]*)/,
    // Comments for documentation
    comment: /^\s*#/,
    // Multi-line constructs
    multiLineStart: /^\s*(?:if|for|while|case|function|\w+\s*\(\s*\))/,
    multiLineEnd: /^\s*(?:fi|done|esac|\})\s*$/,
  } as const;

  async scan(files: readonly string[], options: ScanOptions): Promise<readonly Finding[]> {
    const findings: Finding[] = [];

    // Filter shell files
    const shellFiles = files.filter(file => this.isShellFile(file));

    this.logger.debug(`Shell provider scanning ${shellFiles.length} files`);

    for (const file of shellFiles) {
      try {
        const fileFindings = await this.scanFile(file, options);
        findings.push(...fileFindings);
      } catch (error) {
        this.logger.debug(`Error scanning shell file ${file}: ${error}`);
        // Continue with other files on errors
        continue;
      }
    }

    this.logger.info(`Shell provider found ${findings.length} environment variables`);
    return Object.freeze(findings);
  }

  private async scanFile(filePath: string, options: ScanOptions): Promise<readonly Finding[]> {
    const content = await readFileSafe(filePath, options.maxFileSize ?? 1024 * 1024);
    if (!content) {
      this.logger.debug(`Skipping shell file (empty or too large): ${filePath}`);
      return [];
    }

    try {
      return this.scanContent(content, filePath, options);
    } catch (error) {
      throw new ParseError(
        `Failed to parse shell file: ${error}`,
        filePath
      );
    }
  }

  private scanContent(content: string, filePath: string, options: ScanOptions): readonly Finding[] {
    const findings: Finding[] = [];
    const lines = content.split('\n');
    const publicPrefixes = options.publicPrefixes ?? [];

    // Track variables that are assigned in the file
    const assignedVars = new Set<string>();

    // First pass: find variable assignments
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmedLine = line.trim();

      // Skip comments and empty lines
      if (!trimmedLine || this.patterns.comment.test(trimmedLine)) {
        continue;
      }

      // Check for variable assignments
      const assignMatch = trimmedLine.match(this.patterns.varAssign);
      if (assignMatch) {
        const [, varName] = assignMatch;
        if (varName && isValidEnvVarName(varName)) {
          assignedVars.add(varName);
        }
      }

      // Check for variable declarations
      const declareMatch = trimmedLine.match(this.patterns.varDeclare);
      if (declareMatch) {
        const [, varName] = declareMatch;
        if (varName && isValidEnvVarName(varName)) {
          assignedVars.add(varName);
        }
      }
    }

    // Second pass: find variable references
    const foundVars = new Map<string, Finding>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmedLine = line.trim();
      const lineNumber = i + 1;

      // Skip comments and empty lines
      if (!trimmedLine || this.patterns.comment.test(trimmedLine)) {
        continue;
      }

      // Find variable references in the line
      const varRefs = this.extractVariableReferences(line);

      for (const varRef of varRefs) {
        const { name, hasDefault, defaultValue, startColumn, endColumn } = varRef;

        // Skip if not a valid environment variable name
        if (!isValidEnvVarName(name)) {
          continue;
        }

        // Skip common shell built-ins and special variables
        if (this.isBuiltinVariable(name)) {
          continue;
        }

        // If this variable is assigned locally AND this reference has no default value,
        // then skip it (it's just a local assignment)
        if (assignedVars.has(name) && !hasDefault) {
          continue;
        }

        const fileRef = createFileRef(
          filePath,
          lineNumber,
          endColumn - startColumn + 1,
          this.getContext(lines, i, name)
        );

        // Check if we already have a finding for this variable
        const existingFinding = foundVars.get(name);
        if (existingFinding) {
          // Add this file reference to the existing finding
          const updatedFinding = createFinding(
            name,
            'shell',
            [...existingFinding.files, fileRef],
            {
              required: existingFinding.required && !hasDefault,
              ...(defaultValue ? { defaultValue } : {}),
              isPublic: isPublicVariable(name, publicPrefixes),
            }
          );
          foundVars.set(name, updatedFinding);
        } else {
          // Create new finding
          const finding = createFinding(
            name,
            'shell',
            [fileRef],
            {
              required: !hasDefault,
              ...(defaultValue ? { defaultValue } : {}),
              isPublic: isPublicVariable(name, publicPrefixes),
            }
          );
          foundVars.set(name, finding);
        }
      }
    }

    findings.push(...foundVars.values());
    return Object.freeze(findings);
  }

  private extractVariableReferences(line: string): Array<{
    name: string;
    hasDefault: boolean;
    defaultValue?: string;
    startColumn: number;
    endColumn: number;
  }> {
    const references: Array<{
      name: string;
      hasDefault: boolean;
      defaultValue?: string;
      startColumn: number;
      endColumn: number;
    }> = [];

    // Reset the regex to ensure we start from the beginning
    this.patterns.varRef.lastIndex = 0;

    let match;
    while ((match = this.patterns.varRef.exec(line)) !== null) {
      const fullMatch = match[0];
      let varName: string;
      let hasDefault = false;
      let defaultValue: string | undefined;

      // Check if it's a braced variable (${VAR} or ${VAR:-default})
      if (match[1]) {
        const bracedContent = match[1];
        if (bracedContent.includes(':-')) {
          hasDefault = true;
          const parts = bracedContent.split(':-', 2);
          varName = parts[0] || '';
          defaultValue = parts[1] || '';
          // Remove surrounding quotes if present
          if (defaultValue && defaultValue.startsWith('"') && defaultValue.endsWith('"')) {
            defaultValue = defaultValue.slice(1, -1);
          } else if (defaultValue && defaultValue.startsWith("'") && defaultValue.endsWith("'")) {
            defaultValue = defaultValue.slice(1, -1);
          }
        } else if (bracedContent.includes(':=')) {
          hasDefault = true;
          const parts = bracedContent.split(':=', 2);
          varName = parts[0] || '';
          defaultValue = parts[1] || '';
          // Remove surrounding quotes if present
          if (defaultValue && defaultValue.startsWith('"') && defaultValue.endsWith('"')) {
            defaultValue = defaultValue.slice(1, -1);
          } else if (defaultValue && defaultValue.startsWith("'") && defaultValue.endsWith("'")) {
            defaultValue = defaultValue.slice(1, -1);
          }
        } else {
          varName = bracedContent;
        }
      } else {
        // Simple variable ($VAR)
        varName = match[2] || '';
      }

      if (!varName) continue;

      const startColumn = match.index + 1; // 1-based
      const endColumn = match.index + fullMatch.length;

      const reference: {
        name: string;
        hasDefault: boolean;
        defaultValue?: string;
        startColumn: number;
        endColumn: number;
      } = {
        name: varName,
        hasDefault,
        startColumn,
        endColumn,
      };

      if (defaultValue !== undefined) {
        reference.defaultValue = defaultValue;
      }

      references.push(reference);
    }

    return references;
  }

  private isBuiltinVariable(name: string): boolean {
    // Common shell built-in variables that shouldn't be treated as environment variables
    const builtins = new Set([
      // Positional parameters
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      // Special parameters
      '@', '*', '#', '?', '-', '$', '!', '_',
      // Common shell variables
      'IFS', 'PATH', 'PS1', 'PS2', 'PS3', 'PS4',
      'HOME', 'USER', 'SHELL', 'PWD', 'OLDPWD',
      'RANDOM', 'SECONDS', 'LINENO', 'BASH_VERSION',
      'BASH_SOURCE', 'BASH_LINENO', 'FUNCNAME',
      'PIPESTATUS', 'HOSTNAME', 'HOSTTYPE', 'OSTYPE',
      'MACHTYPE', 'SHLVL', 'PPID', 'EUID', 'UID', 'GID',
      // Loop variables that are commonly used
      'i', 'j', 'k', 'x', 'y', 'z', 'item', 'line', 'file',
    ]);

    return builtins.has(name);
  }

  private getContext(lines: readonly string[], currentLine: number, varName: string): string {
    // Provide context about where the variable is used
    const line = lines[currentLine]?.trim();

    // Check if it's in a conditional
    if (line?.startsWith('if ') || line?.includes(' if ')) {
      return 'Conditional statement';
    }

    // Check if it's in an assignment
    if (line?.includes('=') && !line.startsWith('#')) {
      return 'Variable assignment';
    }

    // Check if it's in a command
    if (line?.startsWith('echo ') || line?.startsWith('printf ')) {
      return 'Output command';
    }

    // Check if it's in an export
    if (line?.startsWith('export ')) {
      return 'Environment export';
    }

    // Look for function context
    for (let i = Math.max(0, currentLine - 5); i <= Math.min(lines.length - 1, currentLine + 2); i++) {
      const contextLine = lines[i]?.trim();
      if (contextLine?.match(/^\w+\s*\(\s*\)/)) {
        const funcName = contextLine.split('(')[0]?.trim();
        return `Function: ${funcName}`;
      }
    }

    return 'Shell script';
  }

  private isShellFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();

    // Check file extension
    if (['.sh', '.bash', '.zsh', '.fish'].includes(ext)) {
      return true;
    }

    // Check common shell script names without extensions
    const fileName = path.basename(filePath).toLowerCase();
    const shellFileNames = [
      'bashrc', '.bashrc', 'bash_profile', '.bash_profile',
      'zshrc', '.zshrc', 'zprofile', '.zprofile',
      'profile', '.profile', 'bashrc.local', 'zshrc.local'
    ];

    return shellFileNames.includes(fileName);
  }
}

/**
 * Create a shell provider instance
 */
export const createShellProvider = (): Provider => {
  return new ShellProvider();
};